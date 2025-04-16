/**
 * Parses file system into directories of media.
 */

import { DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService, MovieMetadata, SeriesMetadata } from "./MediaMetadataService";
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
	metadata?: MovieMetadata,
}

type Series = {
	type: 'series',
	name: string,
	year: string,
	folderName: string,
	relativePath: RelativePath,
	// Seasons are a map because they may not be in order or all present
	seasons?: Array<{
		seasonNumber: number,
		episodes: Array<Playable & {
			seasonNumber: number,
			episodeNumber: number,
			fileName: RelativePath,
			relativePath: RelativePath,
		}>,
	}>,
	metadata?: SeriesMetadata,
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
				metadata: MediaMetadataService.getCachedMetadata({
					type: 'series',
					name,
					year,
				}),
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
					const { name: extraName, type } = getExtraNameAndType(file);
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
					name: removeExtensionsFromFileName(movieFile),
					fileName: movieFile,
					relativePath: path + '/' + movieFile,
					watchProgress: WatchProgressService.getWatchProgress(path + '/' + movieFile)
				},
				extras,
				metadata: MediaMetadataService.getCachedMetadata({
					type: 'movie',
					name,
					year,
				}),
			};
		}

		console.warn(`No movie or series found in folder ${path}`);
		return undefined;
	}


	private static parseNameAndYear(path) {
		// MKae sure we're dealing with the folder/file name, not the full path
		// Also remove anything after a .
		const folderName = removeExtensionsFromFileName(path.split('/').pop());
		const YearRegExp = RegExp(/\((\d{4})\)/g);
		const year = YearRegExp.exec(folderName)?.[1];
		const titleBeforeYear = folderName.split(YearRegExp)[0].trim();

		return {
			name: titleBeforeYear,
			year,
		}
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
					name: removeExtensionsFromFileName(file),
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

}

function removeExtensionsFromFileName(filename: string) {
	// Extensions are everything after a '.' AFTER any spaces
	// After taking everything after the last space, take all but the first segments between '.'s
	const extensions = filename.split(' ').pop()?.split('.');
	extensions?.shift();
	// take everything before the extensions begin
	return filename.split('.' + extensions?.join('.'))[0].trim();
}

function getExtraNameAndType(file: string) {
	const withoutExtensions = removeExtensionsFromFileName(file);
	const type = ExtraTypes.find((type) => withoutExtensions.toLowerCase().endsWith('-' + type));
	const name = type ? withoutExtensions.split('-' + type,)[0].trim() : withoutExtensions;

	return {
		name,
		type: type || null,
	};
}