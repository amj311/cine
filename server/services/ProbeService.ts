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

	public static async getMp3Data(relativePath: string): Promise<any> {
		if (!relativePath) {
			return null;
		}
		try {
			const probe = await ProbeService.getProbeData(relativePath);
			const tags = probe?.full?.format?.tags;
			if (!tags) {
				return null;
			}
			return {
				...tags,
				trackNumber: tags.track?.split('/')[0] ? parseInt(tags.track.split('/')[0]) : undefined,
				trackTotal: tags.track?.split('/')[1] ? parseInt(tags.track.split('/')[1]) : undefined,
				duration: probe?.full?.format?.duration,
			}
		}
		catch (err) {
			console.error("Error while getting mp3 tags:", err);
			return null;
		}
	}


	// public static async getMp3Art(relativePath: string): Promise<any> {
	// 	try {
	// 		const filePath = DirectoryService.resolvePath(relativePath);
	// 		const probe = await ProbeService.getProbeData(relativePath);
	// 		const tags = probe?.full?.format?.tags;
	// 		if (!tags) {
	// 			return null;
	// 		}
	// 		return {
	// 			...tags,
	// 			trackNumber: tags.track.split('/')[0] ? parseInt(tags.track.split('/')[0]) : undefined,
	// 			trackTotal: tags.track.split('/')[1] ? parseInt(tags.track.split('/')[1]) : undefined,
	// 		}
	// 	}
	// 	catch (err) {
	// 		console.error("Error while getting mp3 tags:", err);
	// 		return null;
	// 	}
	// }

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
						if (stream.codec_type === 'subtitle' || stream.codec_type === 'mov_text') {
							const language = stream.tags?.language;
							const handler_name = stream.tags?.handler_name;
							let name = `${language} (${stream.codec_long_name})`;
							if (handler_name && handler_name !== 'SubtitleHandler') {
								name = handler_name;
							}
							probeData.glossary.subtitles.push({
								index: stream.index,
								format: stream.codec_name,
								name,
							});
						}
						else if (stream.codec_type === 'audio') {
							probeData.glossary.audio.push({
								index: stream.index,
								format: stream.codec_name,
								name: stream.tags?.handler_name,
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
