import { AbsolutePath, ConfirmedPath, RelativePath } from './DirectoryService';
import ffmpeg from 'fluent-ffmpeg';
import { safeParseInt } from '../utils/miscUtils';
import { execFile } from 'child_process';
import { useFfmpeg } from '../utils/ffmpeg';

const MAX_CACHE_SIZE = 100; // Maximum number of Probes to cache
const probeCache = new Map<RelativePath, ProbeData>();

type SubtitleTrack = {
	index: number;
	format: string | undefined;
	name?: string;
}

type AudioTrack = {
	index: number;
	format: string | undefined;
	language?: string;
	name?: string;
}

type ProbeData = {
	glossary: {
		duration_s?: number,
		subtitles: SubtitleTrack[];
		audio: AudioTrack[];
		chapters?: Array<{
			title: string;
			start_s: number,
			end_s: number,
		}>,
		hasMultipleVideoFrames: boolean,
	},
	full: ffmpeg.FfprobeData;
}

/** A mix of known tags and custom tags */
type Tags = {
	title?: string,
	disc?: string | number,
	track?: string | number,
	album?: string,
	artist?: string,
	album_artist?: string,
	genre?: string,
} & { [key: string]: string }

type ProbeChapter = {
	id: number,
	time_base: string,
	start: number,
	start_time: number,
	end: number
	end_time: number,
	'TAG:title': string
}

export class ProbeService {

	public static async getTrackData(path: ConfirmedPath) {
		if (!path) {
			return null;
		}
		try {
			const probe = await ProbeService.getProbeData(path);
			if (!probe) {
				return null;
			}

			// make tags uniform lowercase
			const tags = Object.fromEntries(Array.from(Object.entries(probe.full.format.tags || {})).map(([key, value]) => [key.toLowerCase(), value])) as Tags;
			const stringDiscNumber = typeof tags.disc === 'string' ? tags.disc as string : null;
			const slashDiscNumber = stringDiscNumber?.includes('/');
			const stringTrackNumber = typeof tags.track === 'string' ? tags.track as string : null;
			const slashTrackNumber = stringTrackNumber?.includes('/');

			return {
				...tags,
				year: safeParseInt(tags.date),
				subtitles: probe.glossary.subtitles || [],
				discNumber: slashDiscNumber ? safeParseInt(stringDiscNumber!.split('/')[0]) : safeParseInt(tags.disc),
				discTotal: slashDiscNumber ? safeParseInt(stringDiscNumber!.split('/')[1]) : safeParseInt(tags.discTotal),
				trackNumber: slashTrackNumber ? safeParseInt(stringTrackNumber!.split('/')[0]) : safeParseInt(tags.track),
				trackTotal: slashTrackNumber ? safeParseInt(stringTrackNumber!.split('/')[1]) : safeParseInt(tags.trackTotal),
				duration: probe.full.format.duration,
				chapters: probe.full.chapters.map((chapter: ProbeChapter) => ({
					id: chapter.id,
					title: chapter['TAG:title'] || "Chapter " + (chapter.id + 1),
					start_s: chapter.start_time,
					end_s: chapter.end_time,
					duration: chapter.end_time - chapter.start_time,
				})),
				tags,
			}
		}
		catch (err) {
			console.error("Error while getting mp3 tags:", err);
			return null;
		}
	}


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
			await useFfmpeg<void>(async (ffmpeg, resolve, reject) => {
				ffmpeg.ffprobe(filePath, ['-show_chapters'], async (err: any, data) => {
					if (err) {
						console.error("Error while probing file:", err);
						reject(err);
						return;
					}

					probeData = {
						glossary: {
							subtitles: [],
							audio: [],
							chapters: [],
							hasMultipleVideoFrames: false,
						},
						full: data,
					};

					probeData.glossary.duration_s = data?.format.duration;


					if (data && data.streams) {
						for (const stream of data.streams) {
							const handler_name = stream.tags?.handler_name;
							if (stream.codec_type === 'subtitle' || stream.codec_name === 'mov_text' || handler_name === 'SubtitleHandler') {
								if (stream.codec_name === 'bin_data') {
									continue;
								}
								const language = stream.tags?.language;
								let name = stream.tags?.title || `${language} (${stream.codec_name})`;
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
									name: stream.tags?.title || stream.tags?.handler_name,
								});
							}
						}

						// if there are video streams, check if any have multiple frames
						if (data.streams.some(stream => stream.codec_type === 'video')) {
							probeData.glossary.hasMultipleVideoFrames = await ProbeService.hasMultipleVideoFrames(filePath);
						}
					}

					// format chapters
					if (data.chapters) {
						probeData.glossary.chapters = data.chapters.map((c, i) => ({
							title: c.title || c['TAG:title'] || `Chapter ${i + 1}`,
							start_s: c.start_time,
							end_s: c.end_time,
						}))
					}
					resolve();
				});
			});
			return probeData;
		}
		catch (err) {
			console.error("Error while probing file:", err);
			return null;
		}
	}


	/**
	 * Checks the number of video frames in a file.
	 * Useful for making sure it's not just audio.
	 * Audio files can have a video stream, but it will only have 1 frame.
	 * Only looks for frames in the first few seconds to avoid long processing times on large files.
	 * @param filePath 
	 */
	private static async hasMultipleVideoFrames(filePath: AbsolutePath): Promise<boolean> {
		return await useFfmpeg<boolean>((_ffmpeg, resolve, reject) => {
			// use ffprobe to look for video frames in the first 2 seconds of the file
			// select only video streams to avoid non-video frames
			// use exec to call ffprobe directly so we can control the arguments
			const ffprobeBin = process.env.FFPROBE_PATH ?? 'ffprobe';
			const args = [
				'-v', 'error',
				'-select_streams', 'v', // only select video streams
				'-read_intervals', '%+#5', // read the first 5 seconds of the file
				'-show_entries', 'frame=pkt_pts_time,pict_type',
				'-of', 'json',
				filePath,
			];
			execFile(ffprobeBin, args, (error, stdout, stderr) => {
				if (error) {
					console.error("Error while probing file for video frames:", error);
					reject(error);
					return;
				}

				const data = JSON.parse(stdout);
				const videoFrames = data.frames || [];
				resolve(videoFrames.length > 1);
			});
		});
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

	public static clearCacheForPath(path: RelativePath) {
		probeCache.delete(path);
	}

	public static clearEntireCache() {
		probeCache.clear();
	}
}
