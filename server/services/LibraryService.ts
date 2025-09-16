/**
 * Parses file system into directories of media.
 */

import { AbsolutePath, ConfirmedPath, DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata } from "./metadata/MetadataTypes";
import { ProbeService } from "./ProbeService";
import { WatchProgress, WatchProgressService } from "./WatchProgressService";

type LibraryItemData = {
	folderName: string,
	relativePath: RelativePath,
	listName: string,
	sortKey: string,
	metadata: EitherMetadata | null,
	imdbId?: string,
	extras?: Array<Extra>,
	cinemaType?: 'movie' | 'series',
}

type Playable = {
	type: 'movie' | 'episodeFile' | 'episode' | 'extra' | 'album' | 'audiobook',
	name: string,
	version?: string | null,
	fileName: string,
	relativePath: RelativePath,
	watchProgress: WatchProgress | null,
}

const ExtraTypes = ['behindthescenes', 'deleted', 'featurette', 'trailer'] as const;
type ExtraType = typeof ExtraTypes[number];
type Extra = Playable & {
	extraType: ExtraType | null,
	still_thumb: string,
}

type CinemaItem = LibraryItemData & {
	type: 'cinema',
	cinemaType: 'movie' | 'series',
	name: string,
	year: string,
	extras?: Array<Extra>,
	metadata: EitherMetadata | null,
}

type Movie = CinemaItem & {
	type: 'cinema',
	cinemaType: 'movie',
	movie: Playable,
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

type Series = CinemaItem & {
	type: 'cinema',
	cinemaType: 'series',
	numSeasons: number,
	// Seasons are a map because they may not be in order or all present
	seasons?: Array<{
		seasonNumber: number,
		episodeFiles: Array<EpisodeFile>,
	}>,
	metadata: EitherMetadata<'series'> | null,
}


type Album = LibraryItemData & Playable & {
	type: 'album',
	title?: string,
	year?: string,
	artist?: string,
	genre?: string,
	cover_thumb: string,
	cover: string,
	tracks?: Array<{
		relativePath: RelativePath,
		title?: string,
		artist?: string,
		album?: string,
		trackNumber?: number,
		trackTotal?: number,
		duration: number,
	}>,
}

type Audiobook = LibraryItemData & Playable & {
	type: 'audiobook',
	title?: string,
	year?: string,
	author?: string,
	cover_thumb: string,
	cover: string,
	chapterStrategy: 'tracks' | 'chapters',
	// each chapter references a file, but multiple chapters can be in one file
	// in the case of .m4b files all chapters are in one file
	chapters?: Array<{
		relativePath: RelativePath,
		title?: string,
		trackDuration: number,
		chapterDuration: number,
		bookStartOffset: number,
		trackStartOffset: number, // for multiple chapters in the same track
	}>,
}

/** A collection is a specific group of media, like a movie series i.e. Harry Potter */
type Collection = LibraryItemData & {
	type: 'collection',
	name: string,
	children: Array<RelativePath>,
	extras?: Array<Extra>,
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
	libraryType: 'cinema' | 'photos' | 'audio',
	name: string,
	children: Array<RelativePath>,
	confirmedPath: ConfirmedPath,
}

type LibraryItem = Movie | Series | Album | Audiobook | Collection | Folder | Library;






type LibraryFileData = {
	fileName: string,
	relativePath: RelativePath,
	listName: string,
	sortKey: string,
}

const PhotoTypes = ['jpg', 'jpeg', 'png', 'gif'] as const;
type PhotoType = typeof PhotoTypes[number];
export type Photo = LibraryFileData & {
	type: 'photo',
	fileType: PhotoType,
	takenAt?: string,
}

const VideoTypes = ['mp4', '3gp', '3g2'] as const;
type VideoType = typeof VideoTypes[number];
type Video = LibraryFileData & {
	type: 'video',
	fileType: VideoType,
	takenAt?: string,
}

const AudioTypes = ['mp3', 'm4a', 'm4b', 'aac'] as const;
type AudioType = typeof AudioTypes[number];
type Audio = LibraryFileData & {
	type: 'audio',
	fileType: AudioType,
	takenAt?: Date,
}

// Dictionary for faster fileType lookup
const FileTypeDictionary = {
	...Object.fromEntries(PhotoTypes.map((type) => [type, 'photo'])),
	...Object.fromEntries(VideoTypes.map((type) => [type, 'video'])),
	...Object.fromEntries(AudioTypes.map((type) => [type, 'audio'])),
} as const;

type LibraryFile = Photo | Video | Audio;

export class LibraryService {
	public static async parseFolderToItem(path: ConfirmedPath, detailed = false, withMetadata = true): Promise<LibraryItem> {
		const folderName = path.relativePath.split('/').pop() || path.relativePath;
		const { name, year, imdbId } = LibraryService.parseNamePieces(folderName);
		const children = await DirectoryService.listDirectory(path);


		// Take care of series and movies first
		if (year) {
			// Search for "Season" folders
			const allSeasonFolders = children.folders.filter((folder) => folder.name.toLowerCase().includes('season'));
			if (allSeasonFolders.length > 0) {
				const seasons = detailed ? await LibraryService.extractSeasons(allSeasonFolders.map((folder) => folder.confirmedPath)) : undefined;
				// consider files that are not in a season folder as extras
				let extras: Extra[] = [];
				if (detailed) {
					const extraVideos = children.files.filter((file) => !allSeasonFolders.some((folder) => file.name.startsWith(folder.name)));
					extras = LibraryService.prepareExtras(extraVideos.map((file) => file.name), path)
				}

				return {
					type: 'cinema',
					cinemaType: 'series',
					name,
					year,
					imdbId: imdbId || undefined,
					relativePath: path.relativePath,
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
				const { name: mediaName, year: fileYear } = LibraryService.parseNamePieces(file.name);
				return file.name.endsWith('.mp4') && mediaName === name && fileYear === year;
			});
			if (movieFile) {
				let extras: Extra[] = [];
				if (detailed) {
					const extraVideos = children.files.filter((file) => file !== movieFile);
					extras = LibraryService.prepareExtras(extraVideos.map((file) => file.name), path)
				}

				const { version: movieVersion } = LibraryService.parseNamePieces(movieFile.name);

				return {
					type: 'cinema',
					cinemaType: 'movie',
					name,
					year,
					imdbId: imdbId || undefined,
					relativePath: path.relativePath,
					folderName: folderName,
					movie: {
						type: 'movie',
						name: LibraryService.removeExtensionsFromFileName(movieFile.name),
						version: movieVersion,
						fileName: movieFile.name,
						relativePath: movieFile.confirmedPath.relativePath,
						watchProgress: WatchProgressService.getWatchProgress(movieFile.confirmedPath)
					},
					extras,
					metadata: withMetadata ? await MediaMetadataService.getMetadata('movie', path, detailed, true) : null,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				};
			}
		}


		// Identify an album if all children are audio files
		const allChildrenAreAudio = children.files.length > 0 && children.files.every((file) => AudioTypes.includes(file.name.split('.').pop() as AudioType));
		if (allChildrenAreAudio) {
			const firstTrackProbe = await ProbeService.getTrackData(children.files[0].confirmedPath);
			const tracks = detailed ? (await Promise.all(children.files.map(async (file) => {
				const probe = await ProbeService.getTrackData(file.confirmedPath);
				const title = probe?.title || LibraryService.removeExtensionsFromFileName(file.name);
				return {
					type: 'track',
					title,
					artist: probe?.artist,
					album: probe?.album,
					year: probe?.year,
					trackNumber: probe?.trackNumber,
					trackTotal: probe?.trackTotal,
					duration: probe?.duration,
					name: title,
					fileName: file.name,
					relativePath: path.relativePath + '/' + file.name,
					sortKey: (probe?.trackNumber ? probe.trackNumber + '_' : '') + file.name,
					listName: title,
					chapters: probe?.chapters
				} as any;
			}))) : undefined;

			// Compute the start offset for each track
			detailed && tracks!.reduce((acc, track) => {
				track.startOffset = acc;
				acc += track.duration;
				return acc;
			}, 0);
			if (firstTrackProbe?.genre === 'Audiobook' || children.files[0].name.endsWith('.m4b')) {
				const isMb4b = children.files[0].name.endsWith('.m4b');

				return {
					type: 'audiobook',
					title: firstTrackProbe?.album,
					author: firstTrackProbe?.album_artist || firstTrackProbe?.artist,
					year: firstTrackProbe?.year,
					cover_thumb: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=300`,
					cover: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=500`,
					relativePath: path.relativePath,
					folderName: folderName,
					metadata: null,
					sortKey: LibraryService.createSortKey(folderName, firstTrackProbe?.year),
					watchProgress: WatchProgressService.getWatchProgress(path),
					name: firstTrackProbe?.album || name,
					listName: firstTrackProbe?.album || name,
					fileName: path.absolutePath,
					chapterStrategy: isMb4b ? 'chapters' : 'tracks',
					chapters: tracks?.flatMap((track) => {
						if (!isMb4b || !track.chapters || track.chapters.length === 0) {
							return {
								...track,
								trackDuration: track.duration,
								chapterDuration: track.duration,
								bookStartOffset: track.startOffset || 0,
								trackStartOffset: 0,
							}
						}
						return track.chapters.map((chapter) => ({
							...track,
							title: chapter['TAG:title'] || track.title,
							trackDuration: track.duration,
							chapterDuration: chapter.duration,
							bookStartOffset: chapter.start_time || 0,
							trackStartOffset: chapter.start_time || 0,
						}));
					}) || undefined,
				}
			}
			return {
				type: 'album',
				title: firstTrackProbe?.album,
				artist: firstTrackProbe?.album_artist || firstTrackProbe?.artist,
				genre: firstTrackProbe?.genre,
				cover_thumb: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=300`,
				cover: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=500`,
				relativePath: path.relativePath,
				folderName: folderName,
				metadata: null,
				sortKey: LibraryService.createSortKey(folderName),
				watchProgress: WatchProgressService.getWatchProgress(path),
				name: firstTrackProbe?.album || name,
				listName: firstTrackProbe?.album || name,
				fileName: path.absolutePath,
				tracks: tracks || undefined,
			};
		}

		// Root Libraries
		if (path.relativePath.split('/').length === 1) {
			// The library type will be determined by the type of files at its leaf nodes
			const mediaType = await LibraryService.determineMediaTypeInLibrary(path);
			if (mediaType) {
				return {
					type: 'library',
					libraryType: mediaType,
					name,
					relativePath: path.relativePath,
					confirmedPath: path,
					folderName: folderName,
					children: children.folders.map((folder) => folder.confirmedPath.relativePath),
					metadata: null,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				}
			}
		}


		// If all children are media, consider it a collection
		const allChildrenAreMedia = children.folders.length > 0 && children.folders.every((folder) => Boolean(LibraryService.parseNamePieces(folder.name).year));
		if (allChildrenAreMedia) {
			const childrenPaths = children.folders.map((folder) => folder.confirmedPath.relativePath);
			// Allow collections to have extras - video files at the root of the collection folder
			let extras: Extra[] = [];
			if (detailed) {
				const extraVideos = children.files.filter((file) => !childrenPaths.includes(file.confirmedPath.relativePath));
				extras = LibraryService.prepareExtras(extraVideos.map((file) => file.name), path);
			}
			return {
				type: 'collection',
				name,
				relativePath: path.relativePath,
				folderName: folderName,
				children: childrenPaths,
				metadata: null,
				sortKey: LibraryService.createSortKey(folderName),
				listName: name,
				extras,
			};
		}


		// Find feedOrder if specified in the folder name like ".feedorder-1"
		const feedOrderMatch = folderName.match(/\.feedorder-(\d{1,2})/);
		const feedOrder = feedOrderMatch ? parseInt(feedOrderMatch[1]) : null;
		return {
			type: 'folder',
			name,
			relativePath: path.relativePath,
			folderName: folderName,
			children: children.folders.map((folder) => folder.confirmedPath.relativePath),
			feedOrder,
			listName: name,
			sortKey: LibraryService.createSortKey(folderName),
			metadata: null,
		};
	}


	public static async parseFileToItem(path: ConfirmedPath): Promise<LibraryFile | null> {
		const fileType = FileTypeDictionary[path.relativePath.split('.').pop() as keyof typeof FileTypeDictionary];
		if (!fileType) {
			return null;
		}
		const fileName = path.relativePath.split('/').pop() || path.relativePath;
		const takenAt = await LibraryService.getFileTakenAt(path);
		return {
			type: fileType,
			fileType,
			relativePath: path.relativePath,
			fileName: fileName,
			takenAt,
			sortKey: (takenAt?.toISOString() || '') + fileName,
			listName: fileName,
		} as LibraryFile;
	}


	public static async getRootLibraries() {
		const rootLibraries = await DirectoryService.listDirectory(DirectoryService.resolvePath('/')!);
		const libraries = await Promise.all(rootLibraries.folders.map(async (folder) => {
			return {
				folderName: folder.name,
				relativePath: folder.confirmedPath.relativePath,
				libraryItem: await LibraryService.parseFolderToItem(folder.confirmedPath, true),
			};
		}));
		return libraries.filter((library) => library.libraryItem?.type === 'library').map((library) => library.libraryItem) as Library[];
	}


	public static async getFlatTree(path: ConfirmedPath) {
		const items: Array<LibraryItem> = [];
		const files: Array<LibraryFile> = [];
		async function parseDirectory(confirmedPath: ConfirmedPath) {
			const { folders, files: childrenFiles } = await DirectoryService.listDirectory(confirmedPath);
			const libraryItem = await LibraryService.parseFolderToItem(confirmedPath, true);
			if (libraryItem) {
				items.push(libraryItem);
			}
			await Promise.all(childrenFiles.map(async (file) => {
				const fileItem = await LibraryService.parseFileToItem(file.confirmedPath);
				if (fileItem) {
					files.push(fileItem);
				}
			}));
			// Recursively parse all folders
			await Promise.all(folders.map((folder) => parseDirectory(folder.confirmedPath)));
		}
		await parseDirectory(path);
		return { items, files };
	}


	private static async extractSeasons(seasonFolders: Array<ConfirmedPath>) {
		const episodeFiles = await Promise.all(seasonFolders.map(async (folder) => {
			const { files } = await DirectoryService.listDirectory(folder);
			const videoFiles = files.filter((file) => file.name.endsWith('.mp4'));

			return videoFiles.map((file) => {
				const overAllwatchProgress = WatchProgressService.getWatchProgress(file.confirmedPath);

				const NumbersRegex = RegExp(/s(?<seasonNumber>\d{1,3})e(?<firstEpisodeNumber>\d{1,3})/g);
				const numbersMatch = NumbersRegex.exec(file.name)?.groups;
				if (!numbersMatch) {
					console.warn(`File "${file.name}" does not match season/episode regex`);
					return;
				}

				const seasonNumber = parseInt(numbersMatch.seasonNumber);
				const firstEpisodeNumber = parseInt(numbersMatch.firstEpisodeNumber);

				const multipleEpisodesRegex = RegExp(/-e(?<episodeNumber>\d{1,3})/g);
				const lastEspisodeNumber = multipleEpisodesRegex.exec(file.name)?.groups?.episodeNumber;

				const episodeTimesRegex = RegExp(/.e(?<episodeNumber>\d{1,3})-(?<startTime>\d{1,50})/g);
				const timesMatch = Array.from(file.name.matchAll(episodeTimesRegex));
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

				const { version } = LibraryService.parseNamePieces(file.name);
				const episodeName = `S${seasonNumber}:E${firstEpisodeNumber}`;
				const episodes: Episode[] = allEpisodeTimes.map(({ episodeNumber, startTime }, i) => ({
					name: episodeName,
					type: 'episode',
					version,
					fileName: file.name,
					relativePath: file.confirmedPath.relativePath,

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
					fileName: file.name as string,
					relativePath: file.confirmedPath.relativePath,
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

	private static prepareExtras(fileNames: string[], parentPath: ConfirmedPath): Extra[] {
		return fileNames.filter(p => p.endsWith('.mp4')).map((file) => {
			const { name: extraName, type: extraType } = LibraryService.getExtraNameAndType(file);
			return {
				type: 'extra',
				name: extraName,
				extraType,
				fileName: file,
				relativePath: parentPath.append(file).relativePath,
				watchProgress: WatchProgressService.getWatchProgress(parentPath.append(file)),
				still_thumb: `/thumb/${parentPath.append(file).relativePath}?width=300`
			}
		});
	}


	public static async getLibraryForPlayable(path: ConfirmedPath) {
		let playable: Playable | null = null;

		const ancestors = path.relativePath.split('/').slice(0, -1).reduce((paths, thisPath) => {
			const lastPath = paths[paths.length - 1];
			const currentPath = lastPath ? lastPath.append(thisPath) : DirectoryService.resolvePath(thisPath)!;
			return [...paths, currentPath];
		}, [] as Array<ConfirmedPath>).reverse();
		let parentLibrary;
		for (const ancestor of ancestors) {
			const item = await LibraryService.parseFolderToItem(ancestor, true, true);
			if (item && item.type !== 'folder') {
				parentLibrary = item;
				break;
			}
		}

		if (parentLibrary) {
			// Identify playable within the parent library
			playable = (parentLibrary.extras as Array<Extra>)?.find((extra) => path.relativePath === extra.relativePath) || null;
			if (!playable && parentLibrary.cinemaType === 'movie') {
				playable = (parentLibrary as Movie).movie.relativePath === path.relativePath ? parentLibrary.movie : null;
			}
			if (!playable && parentLibrary.cinemaType === 'series') {
				playable = (parentLibrary as Series).seasons?.flatMap((season) => season.episodeFiles).find((episodeFile) => path.relativePath === episodeFile.relativePath) || null;
			}
		}
		else {
			playable = await LibraryService.parseFolderToItem(path) as Playable;
		}


		if (!playable) {
			console.warn(`No playable found for ${path.relativePath}`);
			return {
				parentLibrary,
			};
		}
		return {
			parentLibrary,
			playable,
		}
	}

	public static async getNextEpisode(path: ConfirmedPath) {
		const { parentLibrary, playable } = await LibraryService.getLibraryForPlayable(path);
		if (!parentLibrary || !playable || playable.type !== 'episodeFile') {
			return null;
		}
		const allEpisodes = (parentLibrary as Series).seasons?.flatMap((season) => season.episodeFiles).flatMap((episodeFile) => episodeFile.episodes);
		const currentEpisodeIndex = allEpisodes?.findIndex((episode) => path.relativePath === episode.relativePath);
		if (currentEpisodeIndex === undefined || currentEpisodeIndex === -1) {
			return null;
		}
		const nextEpisode = allEpisodes?.[currentEpisodeIndex + 1];
		return nextEpisode ? {
			...nextEpisode,
			confirmedPath: DirectoryService.resolvePath(nextEpisode.relativePath)!,
		} : null;
	}

	/*********
	 * Helper functions
	 *********/

	public static parseNamePieces(nameOrPath: string) {
		// Make sure we're dealing with the folder/file name, not the full path
		// Also remove anything after a .
		const folderName = LibraryService.removeExtensionsFromFileName(nameOrPath.split('/').pop() || nameOrPath);
		const YearRegExp = RegExp(/\((\d{4})\)/g);
		const year = YearRegExp.exec(folderName)?.[1];
		const titleBeforeYear = folderName.split(YearRegExp)[0].trim();

		const versionRegExp = RegExp(/.version(?<version>[^\.]{1,50})\./g);
		const version = versionRegExp.exec(nameOrPath)?.groups?.version?.replaceAll('_', ' ').trim() || null;

		const imdbRegExp = RegExp(/.imdb-(?<imdbId>tt\d{7,8})/g);
		const imdbId = imdbRegExp.exec(nameOrPath)?.groups?.imdbId?.trim() || null;

		return {
			name: titleBeforeYear,
			year,
			version,
			imdbId,
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

	private static async determineMediaTypeInLibrary(path: ConfirmedPath): Promise<Library['libraryType'] | null> {
		// recursivle search for first descendent that matches a media description
		async function findMediaWithin(path: ConfirmedPath) {
			const { folders, files } = await DirectoryService.listDirectory(path);
			if (folders.length === 0 && files.length === 0) {
				return null;
			}
			for (const file of files) {
				// Not currently saving any images in library other than photos, so we can rely on that here
				if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png')) {
					return 'photos';
				}
				if (file.name.endsWith('.mp3')) {
					return 'audio';
				}
			}
			// Identify cinema folders by release-year folders
			for (const folder of folders) {
				if (LibraryService.parseNamePieces(folder.name).year) {
					return 'cinema'
				}
			}
			for (const folder of folders) {
				const mediaType = await findMediaWithin(folder.confirmedPath);
				if (mediaType) {
					return mediaType;
				}
			}
		}
		return await findMediaWithin(path);
	}

	public static removeArticlesFromName(name: string) {
		// Remove "The ", "A ", "An " from the beginning of the name
		return name.replace(/^(the|a|an)\s+/i, '');
	}

	public static createSortKey(folderName: string, providedYear?: string) {
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

		const yearToUse = providedYear || year || '0000'; // Default to '0000' if no year is found

		const keyParts = [featureName, yearToUse];
		if (collectionName) {
			keyParts.unshift(collectionName, yearToUse);
		}
		return keyParts.join('_').toLowerCase();
	}

	public static async getFileTakenAt(path: ConfirmedPath): Promise<Date | undefined> {
		const regExps: Array<(fileName: string) => Date | undefined> = [
			// YYYYMMDD_HHMMSS or YYYYMMDD-HHMMSS or YYYY-MM-DD_HH-MM-SS(_mmm)
			(fileName) => {
				const dateRegex = /(\d{4})(?:_|-)*(\d{2})(?:_|-)*(\d{2})(?:_|-)*(\d{2})(?:_|-)*(\d{2})(?:_|-)*(\d{2})(?:(?:_|-)*(\d{3}))*/;
				const match = fileName.match(dateRegex);
				if (match) {
					const [_, year, month, day, hour, minute, second] = match;
					return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
				}
				return undefined;
			},
		];
		const fileName = path.relativePath.split('/').pop() || path.relativePath;
		for (const regExp of regExps) {
			const date = regExp(fileName);
			if (date && !isNaN(date.getTime())) {
				return date;
			}
		}
		return undefined;
	}
}
