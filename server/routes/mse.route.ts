import express from 'express';
import { execFile } from 'child_process';
import { DirectoryService } from '../services/DirectoryService';
import { ProbeService } from '../services/ProbeService';
import { LoanService } from '../services/LoanService';
import { getSessionEmail } from '../services/SessionService';
import ffmpeg from 'fluent-ffmpeg';

const route = express.Router({ mergeParams: true });

/** Target duration per chunk in seconds. */
const CHUNK_TARGET_S = 60 * 5;

interface ChunkEntry { start: number; end: number; }

/** In-memory cache of keyframe-aligned chunk indices keyed by absolute path. */
const chunkIndexCache = new Map<string, ChunkEntry[]>();

/**
 * Runs ffprobe to extract all video keyframe timestamps and groups them into
 * chunks of approximately CHUNK_TARGET_S seconds. Chunk boundaries always
 * land on a real keyframe so ffmpeg can seek cleanly with no gaps.
 *
 * Falls back to uniform splits when the container provides no packet-level
 * keyframe info (e.g. some codec-only streams).
 */
/**
 * Seeks to `seekTime` in the file and returns the pts_time of the first
 * keyframe found at or after that position. Reads at most 30 packets so
 * it is fast regardless of file size. Returns null if nothing is found.
 */
function findNextKeyframe(absolutePath: string, seekTime: number): Promise<number | null> {
	// fluent-ffmpeg places extra args before -i, but -read_intervals must come
	// after the input file. Call ffprobe directly so we control argument order.
	const ffprobeBin = process.env.FFPROBE_PATH ?? 'ffprobe';
	return new Promise((resolve) => {
		execFile(ffprobeBin, [
			'-v', 'quiet',
			'-print_format', 'json',
			'-select_streams', 'v:0',
			'-show_packets',
			'-show_entries', 'packet=pts_time,flags',
			'-read_intervals', `${seekTime}%+#30`,
			absolutePath,
		], (err, stdout) => {
			if (err || !stdout) { resolve(null); return; }
			try {
				const data = JSON.parse(stdout);
				const kf = (data.packets as any[] ?? []).find(
					(p: any) => typeof p.flags === 'string' && p.flags.includes('K')
				);
				resolve(kf ? parseFloat(kf.pts_time) : null);
			} catch {
				resolve(null);
			}
		});
	});
}

async function buildChunkIndex(absolutePath: string, duration: number): Promise<ChunkEntry[]> {
	const chunks: ChunkEntry[] = [];
	let chunkStart = 0;

	while (chunkStart < duration - 0.1) {
		const targetEnd = chunkStart + CHUNK_TARGET_S;

		if (targetEnd >= duration) {
			chunks.push({ start: chunkStart, end: duration });
			break;
		}

		// Seek to the target boundary and find the real keyframe there
		const keyframe = await findNextKeyframe(absolutePath, targetEnd);
		const chunkEnd = (keyframe !== null && keyframe < duration) ? keyframe : duration;
		chunks.push({ start: chunkStart, end: chunkEnd });

		if (chunkEnd >= duration - 0.1) break;
		chunkStart = chunkEnd;
	}

	return chunks;
}

function buildH264CodecString(profile: string | undefined, level: number | undefined): string {
	const profileMap: Record<string, number> = {
		'Baseline': 0x42,
		'Constrained Baseline': 0x42,
		'Main': 0x4D,
		'High': 0x64,
		'High 10': 0x6E,
		'High 4:2:2': 0x7A,
		'High 4:4:4 Predictive': 0xF4,
	};
	const profileByte = profileMap[profile ?? ''] ?? 0x64;
	const levelNum = level ?? 40;
	const levelHex = levelNum.toString(16).padStart(2, '0').toUpperCase();
	const profileHex = profileByte.toString(16).padStart(2, '0').toUpperCase();
	return `avc1.${profileHex}00${levelHex}`;
}

const VIDEO_CODEC_MAP: Record<string, string> = {
	'hevc': 'hev1.1.6.L93.B0',
	'av1': 'av01.0.04M.08',
	'vp9': 'vp09.00.10.08',
	'vp8': 'vp8',
};

const AUDIO_CODEC_MAP: Record<string, string> = {
	'aac': 'mp4a.40.2',
	'ac3': 'ac-3',
	'eac3': 'ec-3',
	'mp3': 'mp4a.69',
	'opus': 'opus',
	'flac': 'flac',
	'vorbis': 'vorbis',
};

/**
 * Returns probe info needed for MSE initialization: duration, codec MIME type
 * string, and a keyframe-aligned chunk index. Works with any media file that
 * ffprobe can read.
 */
route.get('/probe', async (req, res) => {
	const { path, audioIndex } = req.query;
	if (!path) {
		res.status(400).json({ error: 'Requires path query param' });
		return;
	}

	const resolvedPath = DirectoryService.resolvePath(path as string);
	if (!resolvedPath) {
		res.status(404).json({ error: 'File not found' });
		return;
	}
	if (!await LoanService.canStreamMedia(resolvedPath, getSessionEmail())) {
		res.status(401).json({ error: 'Not allowed' });
		return;
	}

	const probeData = await ProbeService.getProbeData(resolvedPath);
	if (!probeData) {
		res.status(500).json({ error: 'Failed to probe file' });
		return;
	}

	const audioStreamIdx = audioIndex !== undefined ? parseInt(audioIndex as string, 10) : undefined;

	const videoStream = probeData.full.streams.find(s => s.codec_type === 'video');
	const audioStream = audioStreamIdx !== undefined
		? (probeData.full.streams.find(s => s.index === audioStreamIdx && s.codec_type === 'audio')
			?? probeData.full.streams.find(s => s.codec_type === 'audio'))
		: probeData.full.streams.find(s => s.codec_type === 'audio');

	const videoCodecName = videoStream?.codec_name ?? 'h264';
	const audioCodecName = audioStream?.codec_name ?? 'aac';
	const videoProfile = videoStream?.profile !== undefined ? String(videoStream.profile) : undefined;
	const videoLevel = videoStream?.level !== undefined ? Number(videoStream.level) : undefined;

	const videoCodecStr = videoCodecName === 'h264'
		? buildH264CodecString(videoProfile, videoLevel)
		: (VIDEO_CODEC_MAP[videoCodecName] ?? 'avc1.42E01E');

	const audioCodecStr = AUDIO_CODEC_MAP[audioCodecName] ?? 'mp4a.40.2';

	const duration = probeData.glossary.duration_s ?? 0;

	let chunks = chunkIndexCache.get(resolvedPath.absolutePath);
	if (!chunks) {
		chunks = await buildChunkIndex(resolvedPath.absolutePath, duration);
		chunkIndexCache.set(resolvedPath.absolutePath, chunks);
	}

	res.json({
		duration,
		mimeType: `video/mp4; codecs="${videoCodecStr}, ${audioCodecStr}"`,
		chunks,
	});
});

/**
 * Streams a time-bounded fragment of a media file as a self-contained
 * fragmented MP4 (fMP4) suitable for MSE SourceBuffer.appendBuffer().
 * Works with any container/codec that ffmpeg can remux to fMP4 via stream copy.
 */
route.get('/chunk', async (req, res) => {
	const { path, start, end, audioIndex } = req.query;
	if (!path || start === undefined || end === undefined) {
		res.status(400).json({ error: 'Requires path, start, end query params' });
		return;
	}

	const resolvedPath = DirectoryService.resolvePath(path as string);
	if (!resolvedPath) {
		res.status(404).json({ error: 'File not found' });
		return;
	}
	if (!await LoanService.canStreamMedia(resolvedPath, getSessionEmail())) {
		res.status(401).json({ error: 'Not allowed' });
		return;
	}

	const startSec = parseFloat(start as string);
	const endSec = parseFloat(end as string);
	if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) {
		res.status(400).json({ error: 'Invalid start/end times' });
		return;
	}

	const audioMapArg = audioIndex !== undefined ? `-map 0:${parseInt(audioIndex as string, 10)}` : '-map 0:a:0';

	res.setHeader('Content-Type', 'video/mp4');
	res.setHeader('Cache-Control', 'no-cache');

	let cmd: ReturnType<typeof ffmpeg> | null = null;

	const cleanup = () => {
		try { cmd?.kill('SIGKILL'); } catch (_) { }
	};
	req.on('close', cleanup);
	req.on('error', cleanup);

	cmd = ffmpeg(resolvedPath.absolutePath)
		.seekInput(startSec)
		.duration(endSec - startSec)
		.outputOptions([
			'-map 0:v:0',
			audioMapArg,
			'-c:v copy',
			'-c:a copy',
			'-f mp4',
			'-movflags frag_keyframe+empty_moov+default_base_moof',
		])
		.on('error', (err: Error) => {
			const msg = err.message ?? '';
			// SIGKILL on client disconnect is expected — not worth logging
			if (!msg.includes('SIGKILL') && !msg.includes('killed')) {
				console.error('MSE chunk ffmpeg error:', msg);
				if (!res.headersSent) {
					res.status(500).end();
				}
			}
		});

	cmd.pipe(res as any, { end: true });
});

export default route;
