/**
 * Parses file system into directories of media.
 */

import { DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata } from "./metadata/MetadataTypes";
import { WatchProgress, WatchProgressService } from "./WatchProgressService";

type Playable = {
	name: string,
	version?: string | null,
	fileName: RelativePath,
	relativePath: RelativePath,
	watchProgress: WatchProgress | null,
}

const ExtraTypes = ['behindthescenes', 'deleted', 'featurette', 'trailer'] as const;
type ExtraType = typeof ExtraTypes[number];
type Extra = Playable & {
	type: ExtraType | null,
}

type Movie = {
	type: 'movie',
	name: string,
	year: string,
	folderName: string,
	relativePath: RelativePath,
	movie: Playable,
	extras?: Array<Extra>,
	metadata: EitherMetadata<'movie'> | null,
}

/* A single file may span multiple episodes.
 * For simplicity represent all as any array even if they have just one
*/
type EpisodeFile = {
	seasonNumber: number,
	firstEpisodeNumber: number,
	hasMultipleEpisodes: boolean,
	fileName: string,
	relativePath: RelativePath,
	watchProgress: WatchProgress | null,
	episodes: Array<Episode>,
}

type Episode = Playable & {
	seasonNumber: number,
	episodeNumber: number,
	startTime?: number,
}

type Series = {
	type: 'series',
	name: string,
	year: string,
	folderName: string,
	relativePath: RelativePath,
	numSeasons: number,
	// Seasons are a map because they may not be in order or all present
	seasons?: Array<{
		seasonNumber: number,
		episodeFiles: Array<EpisodeFile>,
	}>,
	metadata: EitherMetadata<'series'> | null,
	extras?: Array<Extra>,
}

type Collection = {
	type: 'collection',
	feedOrder: number | null,
	name: string,
	folderName: string,
	relativePath: RelativePath,
	children: Array<RelativePath>,
}

type LibraryItem = Movie | Series | Collection;

export class LibraryService {
	public static async parseFolderToItem(path: RelativePath, detailed = false): Promise<LibraryItem | undefined> {
		const folderName = path.split('/').pop() || path;
		const { name, year } = LibraryService.parseNamePieces(folderName);
		const children = await DirectoryService.listDirectory(path);

		if (!year) {
			// Find feedOrder if specified in the folder name like ".feedorder-1"
			const feedOrderMatch = folderName.match(/\.feedorder-(\d{1,2})/);
			const feedOrder = feedOrderMatch ? parseInt(feedOrderMatch[1]) : null;
			return {
				type: 'collection',
				name,
				relativePath: path,
				folderName: folderName,
				children: children.folders.map((folder) => path + '/' + folder),
				feedOrder,
			};
		}

		// Search for "Season" folders
		const allSeasonFolders = children.folders.filter((folder) => folder.toLowerCase().includes('season'));
		if (allSeasonFolders.length > 0) {
			const seasons = detailed ? await LibraryService.extractSeasons(allSeasonFolders.map((folder) => path + '/' + folder)) : undefined;
			// consider files that are not in a season folder as extras
			let extras: Extra[] = [];
			if (detailed) {
				const extraVideos = children.files.filter((file) => !allSeasonFolders.some((folder) => file.startsWith(folder)));
				extras = LibraryService.prepareExtras(extraVideos, path)
			}

			return {
				type: 'series',
				name,
				year,
				relativePath: path,
				folderName: folderName,
				seasons,
				numSeasons: allSeasonFolders.length,
				metadata: await MediaMetadataService.getMetadata('series', path, false, true),
				extras,
			};
		}

		// Identify movie when a child item has the same name and year
		const movieFile = children.files.find((file) => {
			const { name: folderName, year: fileYear } = LibraryService.parseNamePieces(file);
			return file.endsWith('.mp4') && folderName === name && fileYear === year;
		});
		if (movieFile) {
			let extras: Extra[] = [];
			if (detailed) {
				const extraVideos = children.files.filter((file) => file !== movieFile);
				extras = LibraryService.prepareExtras(extraVideos, path)
			}

			const { version: movieVersion } = LibraryService.parseNamePieces(movieFile);

			return {
				type: 'movie',
				name,
				year,
				relativePath: path,
				folderName: folderName,
				movie: {
					name: LibraryService.removeExtensionsFromFileName(movieFile),
					version: movieVersion,
					fileName: movieFile,
					relativePath: path + '/' + movieFile,
					watchProgress: WatchProgressService.getWatchProgress(path + '/' + movieFile)
				},
				extras,
				metadata: await MediaMetadataService.getMetadata('movie', path, false, true),
			};
		}

		console.warn(`No movie or series found in folder ${path}`);
		return undefined;
	}



	private static async extractSeasons(seasonFolders) {
		const episodeFiles: EpisodeFile[] = await Promise.all(seasonFolders.map(async (folder) => {
			const { files } = await DirectoryService.listDirectory(folder);
			const videoFiles = files.filter((file) => file.endsWith('.mp4'));

			return videoFiles.map((file) => {
				const overAllwatchProgress = WatchProgressService.getWatchProgress(folder + '/' + file);

				const NumbersRegex = RegExp(/s(?<seasonNumber>\d{1,3})e(?<firstEpisodeNumber>\d{1,3})/g);
				const numbersMatch = NumbersRegex.exec(file)?.groups;
				if (!numbersMatch) {
					console.warn(`File "${file}" does not match season/episode regex`);
					return;
				}

				const seasonNumber = parseInt(numbersMatch.seasonNumber);
				const firstEpisodeNumber = parseInt(numbersMatch.firstEpisodeNumber);

				const multipleEpisodesRegex = RegExp(/-e(?<episodeNumber>\d{1,3})/g);
				const lastEspisodeNumber = multipleEpisodesRegex.exec(file)?.groups?.episodeNumber;

				const episodeTimesRegex = RegExp(/.e(?<episodeNumber>\d{1,3})-(?<startTime>\d{1,50})/g);
				const timesMatch = Array.from(file.matchAll(episodeTimesRegex));
				const extraEpisodeTimes = timesMatch?.map((match) => ({
					episodeNumber: parseInt(match.groups?.episodeNumber || '0'),
					startTime: parseInt(match.groups?.startTime || '0'),
				}))?.sort((a, b) => a.episodeNumber - b.episodeNumber);

				const hasMultipleEpisodes = lastEspisodeNumber !== undefined;
				const hasEpisodeTimes = extraEpisodeTimes?.length > 0;

				function computeEpisodeWatchProgress(
					episodeStartTime: number,
					nextEpisodeStartTime: number | undefined,
					watchProgress: WatchProgress | null
				): WatchProgress | null {
					if (!watchProgress) {
						return null;
					}
					if (watchProgress.time < episodeStartTime) {
						return null;
					}

					const watchTime = watchProgress.time - episodeStartTime;
					const totalFileDuration = watchProgress.duration;
					const epsiodeDuration = (nextEpisodeStartTime || totalFileDuration) - episodeStartTime;
					const percentage = Math.min(watchTime / epsiodeDuration, 1) * 100;

					// Remember that only the percentage is made relative to the episode
					return {
						...watchProgress,
						percentage: Math.round(percentage),
					};
				}

				const allEpisodeTimes = [
					{ episodeNumber: firstEpisodeNumber, startTime: 0 },
					...(extraEpisodeTimes || []),
				]

				const { name, version } = LibraryService.parseNamePieces(file);
				const episodes: Episode[] = allEpisodeTimes.map(({ episodeNumber, startTime }, i) => ({
					name,
					version,
					fileName: file,
					relativePath: folder + '/' + file,

					seasonNumber,
					episodeNumber,
					startTime,
					watchProgress: computeEpisodeWatchProgress(
						startTime,
						allEpisodeTimes[i + 1]?.startTime,
						overAllwatchProgress
					),
				}));

				const episodeFile: EpisodeFile = {
					hasMultipleEpisodes,
					seasonNumber,
					firstEpisodeNumber,
					fileName: file,
					relativePath: folder + '/' + file,
					watchProgress: overAllwatchProgress,
					episodes,
				};
				return episodeFile;
			}).filter((episode) => episode !== undefined);
		}));

		const seasons = new Map<number, Array<EpisodeFile>>();
		episodeFiles.flat().forEach((episode) => {
			if (!seasons.has(episode.seasonNumber)) {
				seasons.set(episode.seasonNumber, []);
			}
			seasons.get(episode.seasonNumber)!.push(episode);
		});


		// Sort each season's episodes by episode number
		return Array.from(seasons.entries()).map(([seasonNumber, seasonEpisodes]) => ({
			seasonNumber,
			episodeFiles: seasonEpisodes.sort((a, b) => a.firstEpisodeNumber - b.firstEpisodeNumber),
		})).sort((a, b) => a.seasonNumber - b.seasonNumber);
	}

	private static prepareExtras(extraPaths: string[], parentPath: string): Extra[] {
		return extraPaths.filter(p => p.endsWith('.mp4')).map((file) => {
			const { name: extraName, type } = LibraryService.getExtraNameAndType(file);
			return {
				name: extraName,
				type,
				fileName: file,
				relativePath: parentPath + '/' + file,
				watchProgress: WatchProgressService.getWatchProgress(parentPath + '/' + file),
			}
		});
	}

	/*********
	 * Helper functions
	 *********/


	public static parseNamePieces(path) {
		// MKae sure we're dealing with the folder/file name, not the full path
		// Also remove anything after a .
		const folderName = LibraryService.removeExtensionsFromFileName(path.split('/').pop());
		const YearRegExp = RegExp(/\((\d{4})\)/g);
		const year = YearRegExp.exec(folderName)?.[1];
		const titleBeforeYear = folderName.split(YearRegExp)[0].trim();

		const versionRegExp = RegExp(/.version(?<version>[^\.]{1,50})\./g);
		const version = versionRegExp.exec(path)?.groups?.version?.replaceAll('_', ' ').trim() || null;
		return {
			name: titleBeforeYear,
			year,
			version,
		}
	}

	private static removeExtensionsFromFileName(filename: string) {
		// Extensions are everything after a '.' AFTER any spaces
		// Regexp for extension: a . followed by anything other than a space
		return filename.split(RegExp(/\.[\S]{1,50}/g))[0] || filename;
	}

	private static getExtraNameAndType(file: string) {
		const withoutExtensions = LibraryService.removeExtensionsFromFileName(file);
		const type = ExtraTypes.find((type) => withoutExtensions.toLowerCase().endsWith('-' + type));
		const name = type ? withoutExtensions.split('-' + type,)[0].trim() : withoutExtensions;

		return {
			name,
			type: type || null,
		};
	}

	public static determineMediaTypeFromPath(path: RelativePath) {
		if (path.toLowerCase().includes('/season ')) {
			return 'series';
		}
		if (path.match(/ \(\d{4}\)./g)) {
			return 'movie';
		}
		return 'collection';
	}
}


// import ffmpeg from 'fluent-ffmpeg';
// console.log(ffmpeg(DirectoryService.resolvePath('Movies/Funny Movies/Stranger Than Fiction (2006)/Stranger Than Fiction (2006).mp4')).ffprobe(console.log))
