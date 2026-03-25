import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseIdx, type IdxFile } from '../utils/idxParser';
import { type ConfirmedPath } from './DirectoryService';
import { ProbeService } from './ProbeService';
import { useFfmpeg } from '../utils/ffmpeg';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDX_PATH = path.join(__dirname, '../../dist/assets/vobsub.idx');
const SUB_PATH = path.join(__dirname, '../../dist/assets/vobsub.sub');
const VOBSUB_BASE = path.join(__dirname, '../../dist/assets/vobsub');
const TEMP_MKV_PATH = path.join(__dirname, '../../dist/assets/temp-vobsub.mkv');

const SUPPORTED_EXTENSIONS = ['mkv', 'mp4', 'avi', 'm4v', 'mov', 'ts', 'm2ts'];

/** In-memory key of the most recently extracted path + track, e.g. "movies/film.mkv:3" */
let currentExtractionKey: string | null = null;

export class VobSubService {
	static async getIdxFile(): Promise<IdxFile | null> {
		try {
			const content = await fs.readFile(IDX_PATH, 'utf-8');
			return parseIdx(content);
		} catch (e: any) {
			if (e.code === 'ENOENT') return null;
			throw e;
		}
	}

	/**
	 * Extract VobSub (.idx + .sub) from a video file using mkvextract.
	 * Writes to dist/assets/vobsub.idx and dist/assets/vobsub.sub.
	 * Returns immediately if the same path + trackIndex were already extracted.
	 */
	static async extractVobSub(confirmedPath: ConfirmedPath, trackIndex: number): Promise<void> {
		const ext = confirmedPath.relativePath.split('.').pop()?.toLowerCase();
		if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
			throw new Error(`Unsupported file type: .${ext}`);
		}

		const probe = await ProbeService.getProbeData(confirmedPath);
		if (!probe) {
			throw new Error('Could not probe file');
		}
		const stream = probe.full.streams.find((s) => s.index === trackIndex);
		if (!stream) {
			throw new Error(`No stream at index ${trackIndex}`);
		}
		if (stream.codec_name !== 'dvd_subtitle') {
			throw new Error(`Stream ${trackIndex} is not dvd_subtitle (got ${stream.codec_name})`);
		}

		const key = `${confirmedPath.relativePath}:${trackIndex}`;
		if (currentExtractionKey === key) {
			return;
		}

		let mkvPath: string;
		let mkvTrackId: number;

		if (ext === 'mkv') {
			// Use the original MKV directly; mkvextract TIDs are 0-based and match ffprobe stream indices
			mkvPath = confirmedPath.absolutePath;
			mkvTrackId = trackIndex;
		} else {
			// Remux the single subtitle stream into a temp MKV
			await useFfmpeg(confirmedPath.absolutePath as any, (ffmpeg, resolve, reject) => {
				ffmpeg
					.outputOptions([`-map 0:${trackIndex}`, '-c copy', '-preset veryfast'])
					.output(TEMP_MKV_PATH)
					.on('end', resolve)
					.on('error', reject)
					.run();
			});
			mkvPath = TEMP_MKV_PATH;
			mkvTrackId = 0;
		}

		await execFileAsync('mkvextract', [mkvPath, 'tracks', `${mkvTrackId}:${VOBSUB_BASE}`]);

		currentExtractionKey = key;
	}

	/**
	 * Read a byte range from the paired .sub file.
	 * If size is omitted, reads from filepos to end-of-file.
	 */
	static async getSubChunk(filepos: number, size?: number): Promise<Buffer | null> {
		try {
			const fd = await fs.open(SUB_PATH, 'r');
			try {
				if (size === undefined) {
					const stat = await fd.stat();
					size = stat.size - filepos;
					if (size <= 0) return Buffer.alloc(0);
				}
				const buffer = Buffer.alloc(size);
				const { bytesRead } = await fd.read(buffer, 0, size, filepos);
				return buffer.subarray(0, bytesRead);
			} finally {
				await fd.close();
			}
		} catch (e: any) {
			if (e.code === 'ENOENT') return null;
			throw e;
		}
	}
}
