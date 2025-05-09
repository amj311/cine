import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { DirectoryService } from './DirectoryService';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const MAX_CACHE_SIZE = 100; // Maximum number of Probes to cache
const probeCache = new Map<string, ProbeData>();

type SubtitleTrack = {
	index: number;
	format: string;
	name?: string;
}

type AudioTrack = {
	index: number;
	format: string;
	language?: string;
	name?: string;
}

type ProbeData = {
	glossary: {
		subtitles: SubtitleTrack[];
		audio: AudioTrack[];
	},
	full: any;
}

export class ProbeService {
	/**
	 * 
	 * @param relativePath 
	 */
	public static async getProbeData(relativePath: string): Promise<ProbeData> {
		try {
			const cachedProbe = ProbeService.getCachedProbe(relativePath);
			if (cachedProbe) {
				return cachedProbe;
			}

			const filePath = DirectoryService.resolvePath(relativePath);
			const probeData = await ProbeService.probeFile(filePath);
			ProbeService.cacheProbe(relativePath, probeData);
			return probeData;
		}
		catch (err) {
			console.error("Error while probing file:", err);
			throw err;
		}
	}

	/**
	 * Probes the file using ffprobe and returns the data.
	 * @param filePath 
	 */
	private static async probeFile(filePath: string): Promise<ProbeData> {
		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(filePath, (err, data) => {
				if (err) {
					console.error("Error while probing file:", err);
					reject(err);
					return;
				}
				const probeData: ProbeData = {
					glossary: {
						subtitles: [],
						audio: []
					},
					full: data
				};
				if (data && data.streams) {
					for (const stream of data.streams) {
						if (stream.codec_type === 'subtitle' && stream.codec_name === 'mov_text') {
							probeData.glossary.subtitles.push({
								index: stream.index,
								format: stream.codec_name,
								name: stream.tags?.title
							});
						}
						else if (stream.codec_type === 'audio') {
							probeData.glossary.audio.push({
								index: stream.index,
								format: stream.codec_name,
								name: stream.tags?.title,
							});
						}
					}
				}
				resolve(probeData);
			});
		});
	}

	private static cacheProbe(relativePath: string, probe: ProbeData) {
		probeCache.set(relativePath, probe);
		if (probeCache.size > MAX_CACHE_SIZE) {
			const oldestKey = probeCache.keys().next().value;
			probeCache.delete(oldestKey);
		}
	}

	private static getCachedProbe(relativePath: string) {
		const cachedProbe = probeCache.get(relativePath);
		if (cachedProbe) {
			return cachedProbe;
		}
		return null;
	}
}