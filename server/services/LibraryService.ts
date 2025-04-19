/**
 * Parses file system into directories of media.
 */

import { DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata, SeriesMetadata } from "./metadata/MetadataTypes";
import { MovieMetadata } from "./metadata/MovieMetadataProvider";
import { WatchProgress, WatchProgressService } from "./WatchProgressService";

type Playable = {
	name: string,
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

type Episode = Playable & {
	seasonNumber: number,
	episodeNumber: number,
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
		episodes: Array<Episode>,
	}>,
	metadata: EitherMetadata<'series'> | null,
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
		const { name, year } = LibraryService.parseNameAndYear(folderName);
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
			return {
				type: 'series',
				name,
				year,
				relativePath: path,
				folderName: folderName,
				seasons,
				numSeasons: allSeasonFolders.length,
				metadata: await MediaMetadataService.getMetadata('series', path, false, true),
			};
		}

		// Identify movie when a child item has the same name and year
		const movieFile = children.files.find((file) => {
			const { name: folderName, year: fileYear } = LibraryService.parseNameAndYear(file);
			return file.endsWith('.mp4') && folderName === name && fileYear === year;
		});
		if (movieFile) {
			let extras: Extra[] = [];
			if (detailed) {
				const extraVideos = children.files.filter((file) => file !== movieFile && file.endsWith('.mp4'));
				extras = extraVideos.map((file) => {
					const { name: extraName, type } = LibraryService.getExtraNameAndType(file);
					return {
						name: extraName,
						type,
						fileName: file,
						relativePath: path + '/' + file,
						watchProgress: WatchProgressService.getWatchProgress(path + '/' + file),
					}
				});
			}

			return {
				type: 'movie',
				name,
				year,
				relativePath: path,
				folderName: folderName,
				movie: {
					name: LibraryService.removeExtensionsFromFileName(movieFile),
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
		const episodes = await Promise.all(seasonFolders.map(async (folder) => {
			const { files } = await DirectoryService.listDirectory(folder);
			return files.map((file) => {
				const NumbersRegex = RegExp(/s(?<seasonNumber>\d{1,3})e(?<episodeNumber>\d{1,3})/g);
				const numbersMatch = NumbersRegex.exec(file)?.groups;
				if (!numbersMatch) {
					console.warn(`File "${file}" does not match season/episode regex`);
					return;
				}
				return {
					seasonNumber: parseInt(numbersMatch.seasonNumber),
					episodeNumber: parseInt(numbersMatch.episodeNumber),
					name: LibraryService.removeExtensionsFromFileName(file),
					fileName: file,
					relativePath: folder + '/' + file,
					watchProgress: WatchProgressService.getWatchProgress(folder + '/' + file),
				}
			}).filter((episode) => episode !== undefined);
		}));

		const seasons = new Map();
		episodes.flat().forEach((episode) => {
			if (!seasons.has(episode.seasonNumber)) {
				seasons.set(episode.seasonNumber, []);
			}
			seasons.get(episode.seasonNumber).push(episode);
		});


		// Sort each season's episodes by episode number
		return Array.from(seasons.entries()).map(([seasonNumber, seasonEpisodes]) => ({
			seasonNumber,
			episodes: seasonEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
		})).sort((a, b) => a.seasonNumber - b.seasonNumber);
	}


	/*********
	 * Helper functions
	 *********/


	public static parseNameAndYear(path) {
		// MKae sure we're dealing with the folder/file name, not the full path
		// Also remove anything after a .
		const folderName = LibraryService.removeExtensionsFromFileName(path.split('/').pop());
		const YearRegExp = RegExp(/\((\d{4})\)/g);
		const year = YearRegExp.exec(folderName)?.[1];
		const titleBeforeYear = folderName.split(YearRegExp)[0].trim();

		return {
			name: titleBeforeYear,
			year,
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
