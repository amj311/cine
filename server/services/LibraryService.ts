/**
 * Parses file system into directories of media.
 */

import { DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata } from "./metadata/MetadataTypes";
import { WatchProgress, WatchProgressService } from "./WatchProgressService";

type LibraryItemData = {
	folderName: string,
	relativePath: RelativePath,
	listName: string,
	sortKey: string,
	metadata: EitherMetadata | null,
}

type Playable = {
	type: 'movie' | 'episodeFile' | 'episode' | 'extra',
	name: string,
	version?: string | null,
	fileName: RelativePath,
	relativePath: RelativePath,
	watchProgress: WatchProgress | null,
}

const ExtraTypes = ['behindthescenes', 'deleted', 'featurette', 'trailer'] as const;
type ExtraType = typeof ExtraTypes[number];
type Extra = Playable & {
	extraType: ExtraType | null,
}

type Movie = LibraryItemData & {
	type: 'movie',
	name: string,
	year: string,
	movie: Playable,
	extras?: Array<Extra>,
	metadata: EitherMetadata<'movie'> | null,
}

/* A single file may span multiple episodes.
 * For simplicity represent all as any array even if they have just one
*/
type EpisodeFile = Playable & {
	seasonNumber: number,
	firstEpisodeNumber: number,
	hasMultipleEpisodes: boolean,
	episodes: Array<Episode>,
}

type Episode = Playable & {
	seasonNumber: number,
	episodeNumber: number,
	startTime?: number,
}

type Series = LibraryItemData & {
	type: 'series',
	name: string,
	year: string,
	numSeasons: number,
	// Seasons are a map because they may not be in order or all present
	seasons?: Array<{
		seasonNumber: number,
		episodeFiles: Array<EpisodeFile>,
	}>,
	metadata: EitherMetadata<'series'> | null,
	extras?: Array<Extra>,
}

/** A collection is a specific group of media, like a movie series i.e. Harry Potter */
type Collection = LibraryItemData & {
	type: 'collection',
	name: string,
	children: Array<RelativePath>,
}

/** A folder is more generic than a collection and could contain anything */
type Folder = LibraryItemData & {
	type: 'folder',
	feedOrder: number | null,
	name: string,
	children: Array<RelativePath>,
}

/** A library is a root-level entity containing all of one type of media */
type Library = LibraryItemData & {
	type: 'library',
	libraryType: 'tv' | 'movies' | 'photos',
	name: string,
	children: Array<RelativePath>,
}

type LibraryItem = Movie | Series | Collection | Folder | Library;

export class LibraryService {
	public static async parseFolderToItem(path: RelativePath, detailed = false, withMetadata = false): Promise<LibraryItem | undefined> {
		const folderName = path.split('/').pop() || path;
		const { name, year } = LibraryService.parseNamePieces(folderName);
		const children = await DirectoryService.listDirectory(path);


		// Take care of series and movies first
		if (year) {
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
					metadata: withMetadata ? await MediaMetadataService.getMetadata('series', path, detailed, true) : null,
					extras,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
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
						type: 'movie',
						name: LibraryService.removeExtensionsFromFileName(movieFile),
						version: movieVersion,
						fileName: movieFile,
						relativePath: path + '/' + movieFile,
						watchProgress: WatchProgressService.getWatchProgress(path + '/' + movieFile)
					},
					extras,
					metadata: withMetadata ? await MediaMetadataService.getMetadata('movie', path, detailed, true) : null,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				};
			}
		}

		// Root Libraries
		if (path.split('/').length === 1) {
			console.log('\n\n\n\n\n\n\nRoot library detected. Determining type.', path);
			// The library type will be determined by the type of files at its leaf nodes
			const mediaType = await LibraryService.determineMediaTypeInLibrary(path);
			console.log("got media type", mediaType)
			if (mediaType) {
				return {
					type: 'library',
					libraryType: mediaType,
					name,
					relativePath: path,
					folderName: folderName,
					children: children.folders.map((folder) => path + '/' + folder),
					metadata: null,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				}
			}
		}


		// If all children are media, consider it a collection
		const allChildrenAreMedia = children.folders.length > 0 && children.folders.every((folderName) => Boolean(LibraryService.parseNamePieces(folderName).year));
		if (allChildrenAreMedia) {
			const childrenPaths = children.folders.map((folder) => path + '/' + folder);
			return {
				type: 'collection',
				name,
				relativePath: path,
				folderName: folderName,
				children: childrenPaths,
				metadata: null,
				sortKey: LibraryService.createSortKey(folderName),
				listName: name,
			};
		}


		// Find feedOrder if specified in the folder name like ".feedorder-1"
		const feedOrderMatch = folderName.match(/\.feedorder-(\d{1,2})/);
		const feedOrder = feedOrderMatch ? parseInt(feedOrderMatch[1]) : null;
		return {
			type: 'folder',
			name,
			relativePath: path,
			folderName: folderName,
			children: children.folders.map((folder) => path + '/' + folder),
			feedOrder,
			listName: name,
			sortKey: LibraryService.createSortKey(folderName),
			metadata: null,
		};
	}


	public static async getFlatTree(path: RelativePath): Promise<Array<LibraryItem>> {
		const items: Array<LibraryItem> = [];
		async function parseDirectory(path: RelativePath) {
			const { folders, files } = await DirectoryService.listDirectory(path);
			const libraryItem = await LibraryService.parseFolderToItem(path, true);
			if (libraryItem) {
				items.push(libraryItem);
			}
			// Recursively parse all folders
			await Promise.all(folders.map((folder) => parseDirectory(path + '/' + folder)));
		}
		await parseDirectory(path);
		return items;
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

				const { version } = LibraryService.parseNamePieces(file);
				const episodeName = `S${seasonNumber}:E${firstEpisodeNumber}`;
				const episodes: Episode[] = allEpisodeTimes.map(({ episodeNumber, startTime }, i) => ({
					name: episodeName,
					type: 'episode',
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
					type: 'episodeFile',
					hasMultipleEpisodes,
					seasonNumber,
					firstEpisodeNumber,
					fileName: file,
					relativePath: folder + '/' + file,
					watchProgress: overAllwatchProgress,
					episodes,
					name: lastEspisodeNumber ? `Episodes ${firstEpisodeNumber} - ${Number(lastEspisodeNumber)}` : episodeName,
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
			const { name: extraName, type: extraType } = LibraryService.getExtraNameAndType(file);
			return {
				type: 'extra',
				name: extraName,
				extraType,
				fileName: file,
				relativePath: parentPath + '/' + file,
				watchProgress: WatchProgressService.getWatchProgress(parentPath + '/' + file),
			}
		});
	}


	public static async getLibraryForPlayable(relativePath: RelativePath) {
		// find the parent which contains a name and year
		const ancestors = relativePath.split('/').slice(0, -1);
		const parentFolder = ancestors.reverse().find((folder) => {
			const { name, year } = LibraryService.parseNamePieces(folder);
			return !!name && !!year;
		});
		if (!parentFolder) {
			console.warn(`No parent found for ${relativePath}`);
			return {};
		}
		const parentPath = relativePath.split(parentFolder)[0] + parentFolder;
		const parentLibrary = await LibraryService.parseFolderToItem(parentPath, true) as LibraryItem;
		if (!parentLibrary) {
			console.warn(`No parent library found for ${relativePath}`);
			return {};
		}
		// Identify playable within the parent library
		const playable = (parentLibrary as Movie).extras?.find((extra) => extra.relativePath === relativePath)
			|| ((parentLibrary as Movie).movie?.relativePath === relativePath ? (parentLibrary as Movie).movie : null)
			|| (parentLibrary as Series).seasons?.flatMap((season) => season.episodeFiles).find((episodeFile) => episodeFile.relativePath === relativePath);

		if (!playable) {
			console.warn(`No playable found for ${relativePath}`);
			return {
				parentLibrary,
			};
		}
		return {
			parentLibrary,
			playable,
		}
	}

	public static async getNextEpisode(relativePath: RelativePath) {
		const { parentLibrary, playable } = await LibraryService.getLibraryForPlayable(relativePath);
		if (!parentLibrary || !playable || playable.type !== 'episodeFile') {
			return null;
		}
		const allEpisodes = (parentLibrary as Series).seasons?.flatMap((season) => season.episodeFiles).flatMap((episodeFile) => episodeFile.episodes);
		const currentEpisodeIndex = allEpisodes?.findIndex((episode) => episode.relativePath === playable.relativePath);
		if (currentEpisodeIndex === undefined || currentEpisodeIndex === -1) {
			return null;
		}
		const nextEpisode = allEpisodes?.[currentEpisodeIndex + 1];
		return nextEpisode || null;
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
		if (path.match(/ \(\d{4}\)/g)) {
			return 'movie';
		}
		return 'folder';
	}

	private static async determineMediaTypeInLibrary(path: RelativePath) {
		// recursivle search for first descendent that matches a media description
		async function findMediaWithin(path: RelativePath) {
			const { folders, files } = await DirectoryService.listDirectory(path);
			if (folders.length === 0 && files.length === 0) {
				return null;
			}
			// Not currently saving any images in library other than photos, so we can rely on that here
			for (const file of files) {
				if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
					return 'photos';
				}
			}
			// Identify cinema folders by release-year folders
			for (const folder of folders) {
				if (LibraryService.parseNamePieces(folder).year) {
					const { folders: cinemaFolders, files: cinemaFiles } = await DirectoryService.listDirectory(path + '/' + folder);
					if (folders.find(folderName => folderName.toLowerCase().includes('season'))) {
						return 'tv';
					}
					return 'movies'
				}
			}
			console.log("Did not find movie in folder", path, folders)
			return null;
		}
		return await findMediaWithin(path);
	}

	public static removeArticlesFromName(name: string) {
		// Remove "The ", "A ", "An " from the beginning of the name
		return name.replace(/^(the|a|an)\s+/i, '');
	}

	public static createSortKey(folderName: string) {
		const { name, year } = LibraryService.parseNamePieces(folderName);
		const withoutArticles = LibraryService.removeArticlesFromName(name);
		let collectionName = '';
		let featureName = withoutArticles;

		const collectionNameRegexp = RegExp(/(?<series>^[^\d:]{1,100})((?<number>\d{1,3})+|:|and the):*(?<title>.{1,100})*/g);
		const collectionNameMatch = collectionNameRegexp.exec(withoutArticles);
		if (collectionNameMatch) {
			collectionName = collectionNameMatch.groups?.series?.trim() || '';
			featureName = collectionNameMatch.groups?.title?.trim() || withoutArticles;
		}

		const keyParts = [featureName, year];
		if (collectionName) {
			keyParts.unshift(collectionName, year);
		}
		return keyParts.join('_').toLowerCase();
	}
}

// import ffmpeg from 'fluent-ffmpeg';
// console.log(ffmpeg(DirectoryService.resolvePath('Movies/Funny Movies/Stranger Than Fiction (2006)/Stranger Than Fiction (2006).mp4')).ffprobe(console.log))
