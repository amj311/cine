import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { type ConfirmedPath } from './DirectoryService';
import { ProbeService } from './ProbeService';
import { useFfmpeg } from '../utils/ffmpeg';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUP_PATH = path.join(__dirname, '../../dist/assets/pgs.sup');
const TEMP_MKV_PATH = path.join(__dirname, '../../dist/assets/temp-pgs.mkv');

const SUPPORTED_EXTENSIONS = ['mkv', 'mp4', 'avi', 'm4v', 'mov', 'ts', 'm2ts'];

/** SUP segment type codes */
const SEG_PCS = 0x16;
const SEG_END = 0x80;

/** Size of the fixed-length SUP packet header (magic + PTS + DTS + type + segLen). */
const PACKET_HEADER = 13;

export interface PgsEntry {
	/** Presentation timestamp in milliseconds (from the PCS packet PTS). */
	pts_ms: number;
	/** Byte offset of the display set's first packet (PCS) within pgs.sup. */
	offset: number;
	/** Total byte length of the display set, including the END packet. */
	size: number;
	/** True when the PCS object_count is 0 (erase / clear-screen event). */
	isEmpty: boolean;
}

/** In-memory key of the most recently extracted path + track. */
let currentExtractionKey: string | null = null;

export class PgsService {
	/**
	 * Extract the PGS (.sup) subtitle track from a video file using mkvextract.
	 * Writes to dist/assets/pgs.sup.
	 * Returns immediately if the same path + trackIndex were already extracted.
	 */
	static async extractPgs(confirmedPath: ConfirmedPath, trackIndex: number): Promise<void> {
		const ext = confirmedPath.relativePath.split('.').pop()?.toLowerCase();
		if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
			throw new Error(`Unsupported file type: .${ext}`);
		}

		const probe = await ProbeService.getProbeData(confirmedPath);
		if (!probe) throw new Error('Could not probe file');

		const stream = probe.full.streams.find((s) => s.index === trackIndex);
		if (!stream) throw new Error(`No stream at index ${trackIndex}`);
		if (stream.codec_name !== 'hdmv_pgs_subtitle') {
			throw new Error(`Stream ${trackIndex} is not hdmv_pgs_subtitle (got ${stream.codec_name})`);
		}

		const key = `${confirmedPath.relativePath}:${trackIndex}`;
		if (currentExtractionKey === key) return;

		let mkvPath: string;
		let mkvTrackId: number;

		if (ext === 'mkv') {
			mkvPath = confirmedPath.absolutePath;
			mkvTrackId = trackIndex;
		} else {
			// Remux the single subtitle stream into a temp MKV first
			await useFfmpeg(confirmedPath.absolutePath as any, (ffmpeg, resolve, reject) => {
				ffmpeg
					.outputOptions([`-map 0:${trackIndex}`, '-c copy'])
					.output(TEMP_MKV_PATH)
					.on('end', resolve)
					.on('error', reject)
					.run();
			});
			mkvPath = TEMP_MKV_PATH;
			mkvTrackId = 0;
		}

		await execFileAsync('mkvextract', [mkvPath, 'tracks', `${mkvTrackId}:${SUP_PATH}`]);
		currentExtractionKey = key;
	}

	/**
	 * Scan pgs.sup and return one entry per display set.
	 *
	 * Each display set is a run of segments from a PCS (0x16) through an
	 * END (0x80). The PTS from the PCS header is used as the display timestamp.
	 * isEmpty is true when the PCS object_count field is 0 (clear-screen event).
	 *
	 * Returns null if the file does not exist.
	 */
	static async buildIndex(): Promise<PgsEntry[] | null> {
		let fd: Awaited<ReturnType<typeof fs.open>> | null = null;
		try {
			fd = await fs.open(SUP_PATH, 'r');
			const { size: fileSize } = await fd.stat();

			const entries: PgsEntry[] = [];
			const header = Buffer.alloc(PACKET_HEADER);
			// Extra buffer to read the PCS segment data up to object_count byte
			const pcsPrefix = Buffer.alloc(11);

			let offset = 0;
			let setStart = -1;
			let setPts   = 0;
			let setIsEmpty = false;

			while (offset + PACKET_HEADER <= fileSize) {
				const { bytesRead } = await fd.read(header, 0, PACKET_HEADER, offset);
				if (bytesRead < PACKET_HEADER) break;

				// Every SUP packet starts with the magic bytes "PG"
				if (header[0] !== 0x50 || header[1] !== 0x47) break;

				// PTS is a 90 kHz clock value stored as big-endian uint32
				const pts = ((header[2] << 24) | (header[3] << 16) | (header[4] << 8) | header[5]) >>> 0;
				const type   = header[10];
				const segLen = (header[11] << 8) | header[12];

				if (type === SEG_PCS) {
					setStart = offset;
					setPts   = pts / 90; // 90 kHz → milliseconds

					// Read up to 11 bytes of PCS segment data to get object_count (byte 10)
					if (segLen >= 11) {
						await fd.read(pcsPrefix, 0, 11, offset + PACKET_HEADER);
						setIsEmpty = pcsPrefix[10] === 0;
					} else {
						setIsEmpty = true;
					}
				}

				if (type === SEG_END && setStart >= 0) {
					// Display set spans [setStart, offset + PACKET_HEADER + segLen)
					const size = offset + PACKET_HEADER + segLen - setStart;
					entries.push({ pts_ms: setPts, offset: setStart, size, isEmpty: setIsEmpty });
					setStart = -1;
				}

				offset += PACKET_HEADER + segLen;
			}

			return entries;
		} catch (e: any) {
			if (e.code === 'ENOENT') return null;
			throw e;
		} finally {
			await fd?.close();
		}
	}

	/**
	 * Read a display set byte range from pgs.sup.
	 * Returns null if the file does not exist.
	 */
	static async getDisplaySet(offset: number, size: number): Promise<Buffer | null> {
		try {
			const fd = await fs.open(SUP_PATH, 'r');
			try {
				const buffer = Buffer.alloc(size);
				const { bytesRead } = await fd.read(buffer, 0, size, offset);
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
