import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { AbsolutePath, ConfirmedPath, DirectoryService, RelativePath } from './DirectoryService';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const MAX_CACHE_SIZE = 100; // Maximum number of Probes to cache
const probeCache = new Map<RelativePath, ProbeData>();

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

	public static async getTrackData(path: ConfirmedPath): Promise<any> {
		if (!path) {
			return null;
		}
		try {
			const probe = await ProbeService.getProbeData(path);
			const tags = probe?.full?.format?.tags || {};
			return {
				...tags,
				year: tags.date ? parseInt(tags.date) : undefined,
				subtitles: probe?.glossary?.subtitles || [],
				trackNumber: tags.track?.split('/')[0] ? parseInt(tags.track.split('/')[0]) : undefined,
				trackTotal: tags.track?.split('/')[1] ? parseInt(tags.track.split('/')[1]) : undefined,
				duration: probe?.full?.format?.duration,
				chapters: probe?.full?.chapters,
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
	 * @param filePath 
	 */
	public static async getProbeData(filePath: ConfirmedPath): Promise<ProbeData | null> {
		try {
			const cachedProbe = ProbeService.getCachedProbe(filePath.relativePath);
			if (cachedProbe) {
				return cachedProbe;
			}

			const probeData = await ProbeService.probeFile(filePath.absolutePath);
			if (probeData) {
				ProbeService.cacheProbe(filePath.relativePath, probeData);
			}
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
	private static async probeFile(filePath: AbsolutePath): Promise<ProbeData | null> {
		let probeData: ProbeData | null = null;
		try {
			probeData = await new Promise((resolve, reject) => {
				ffmpeg.ffprobe(filePath, ['-show_chapters'], (err: any, data: any) => {
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
							const handler_name = stream.tags?.handler_name;
							if (stream.codec_type === 'subtitle' || stream.codec_name === 'mov_text' || handler_name === 'SubtitleHandler') {
								const language = stream.tags?.language;
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
			return probeData;
		}
		catch (err) {
			console.error("Error while probing file:", err);
			return null;
		}
	}

	private static cacheProbe(path: RelativePath, probe: ProbeData) {
		probeCache.set(path, probe);
		if (probeCache.size > MAX_CACHE_SIZE) {
			const oldestKey = probeCache.keys().next().value;
			probeCache.delete(oldestKey || '' as RelativePath);
		}
	}

	private static getCachedProbe(path: RelativePath) {
		const cachedProbe = probeCache.get(path);
		if (cachedProbe) {
			return cachedProbe;
		}
		return null;
	}
}
