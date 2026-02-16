/**
 * Parses file system into directories of media.
 */

import { AbsolutePath, ConfirmedPath, DirectoryService, RelativePath } from "./DirectoryService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata } from "./metadata/MetadataTypes";
import { ProbeService } from "./ProbeService";
import { SurpriseRecord, SurpriseService } from "./SurpriseService";
import { WatchProgress, WatchProgressService } from "./WatchProgressService";

type Stratified<B = {}, D = {}, M = {}> = {
	base: B,
	details: D,
	meta: M,
}
type Join<S extends Stratified, T extends Partial<Stratified>> = {
	base: S['base'] & T['base'],
	details: S['details'] & T['details'],
	meta: S['meta'] & T['meta'],
}

type Base<S extends Stratified> = S['base'];
type Maybe<S extends Stratified> = S['base'] & Partial<S['details']>;
type Full<S extends Stratified> = S['base'] & Partial<S['details']> & S['meta'];

type LibraryItemStratBase = Stratified<
	{
		folderName: string,
		relativePath: RelativePath,
		listName: string,
		sortKey: string,
		imdbId?: string,
	},
	{},
	{
		metadata?: EitherMetadata | null,
		surprise: SurpriseRecord | null,
		children: Array<RelativePath>,
	}
>

export type Playable = {
	type: 'movie' | 'episodeFile' | 'episode' | 'extra' | 'album' | 'audiobook',
	name: string,
	year?: string,
	seriesName?: string, // i.e. "Harry Potter" or "Friends"
	seasonNumber?: number,
	episodeNumber?: number,
	version?: string | null,
	fileName: string,
	relativePath: RelativePath,
	confirmedPath: ConfirmedPath,
	watchProgress?: WatchProgress | null,
	duration?: number,
}

const ExtraTypes = ['behindthescenes', 'deleted', 'featurette', 'trailer'] as const;
type ExtraType = typeof ExtraTypes[number];
type Extra = Playable & {
	type: 'extra',
	extraType: ExtraType | null,
	still_thumb: string,
}

type CinemaItemStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'cinema',
		cinemaType: 'movie' | 'series',
		name: string,
		year: string,
	},
	{
		extras: Array<Extra>,
	}
>>

type MovieCinemaStrat = Join<CinemaItemStrat, Stratified<{
	cinemaType: 'movie',
	movie: MoviePlayable,
}>>

type MoviePlayable = Playable & {
	type: 'movie',
	name: string,
	year: string,
}



/* A single file may span multiple episodes.
 * For simplicity represent all as any array even if they have just one
*/
type EpisodeFile = Playable & {
	type: 'episodeFile',
	seriesName: string,
	year: string,
	seasonNumber: number,
	firstEpisodeNumber: number,
	hasMultipleEpisodes: boolean,
	episodes: Array<Episode>,
}

type Episode = Playable & {
	type: 'episode',
	seriesName: string,
	year: string,
	seasonNumber: number,
	episodeNumber: number,
	startTime?: number,
}

type Season = {
	seasonNumber: number,
	episodeFiles: Array<EpisodeFile>,
	// season-specific extras
	extras: Array<Extra>,
}

type SeriesCinemaStrat = Join<CinemaItemStrat, Stratified<
	{
		cinemaType: 'series',
		numSeasons: number,
	},
	{
		seasons: Array<Season>,
	}
>>

type AlbumStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'album',
		title?: string,
		year?: string,
		artist?: string,
		genre?: string,
		cover_thumb: string,
		cover: string,
	} & Playable,
	{
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
>>

type AudiobookStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'audiobook',
		title?: string,
		year?: string,
		author?: string,
		cover_thumb: string,
		cover: string,
		chapterStrategy: 'tracks' | 'chapters',
	} & Playable,
	{
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
>>

export type AnyPlayable = MoviePlayable | Episode | EpisodeFile | Base<AlbumStrat> | Base<AudiobookStrat> | Extra;

/** A collection is a specific group of media, like a movie series i.e. Harry Potter */
type CollectionStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'collection',
		name: string,
		feedOrder: number | null,
	},
	{
		extras?: Array<Extra>,
	}
>>


/** A folder is more generic than a collection and could contain anything */
type FolderStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'folder',
		feedOrder: number | null,
		name: string,
	}
>>

/** A library is a root-level entity containing all of one type of media */
type LibraryStrat = Join<LibraryItemStratBase, Stratified<
	{
		type: 'library',
		libraryType: 'cinema' | 'photos' | 'audio',
		name: string,
		confirmedPath: ConfirmedPath,
	}
>>

type LibraryItemStrat = MovieCinemaStrat | SeriesCinemaStrat | AlbumStrat | AudiobookStrat | CollectionStrat | FolderStrat | LibraryStrat;




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
	static readonly itemCache = new Map<string, Base<LibraryItemStrat>>();
	static readonly itemDetailCache = new Map<string, LibraryItemStrat['details']>();
	static readonly fileCache = new Map<string, LibraryFile | null>();

	public static emptyCaches() {
		this.itemCache.clear()
		this.itemDetailCache.clear();
		this.fileCache.clear();
	}

	public static async parseFolderToItem(path: ConfirmedPath, detailed = false, withMetadata = true): Promise<Full<LibraryItemStrat>> {
		let base: Base<LibraryItemStrat> | undefined = this.itemCache.get(path.relativePath);
		if (!base) {
			const item = await this.computeFolderToItem(path);
			base = item;

			// don't cache non-item types
			const uncachedTypes: Array<Base<LibraryItemStrat>['type']> = ['library', 'folder', 'collection'];
			if (!uncachedTypes.includes(base.type)) {
				this.itemCache.set(path.relativePath, item);
			}
		}

		// Add surprise for everything, but after cache
		const childrenDir = await DirectoryService.listDirectory(path);

		let item: Full<LibraryItemStrat> = {
			...base,
			surprise: await SurpriseService.getSurprise(path),
			children: childrenDir.folders.map((folder) => folder.confirmedPath.relativePath),
		}

		// Also cache details since they can be slow (episodes and audio tracks)
		if (detailed) {
			item = await this.joinLibraryItemDetails(path, item);
		}
		if (withMetadata) {
			item = await this.joinLibraryItemMetadata(path, item);
		}
		await LibraryService.joinProgressDeep(item);
		return item;
	};

	private static async computeFolderToItem(path: ConfirmedPath): Promise<Base<LibraryItemStrat>> {
		const folderName = path.relativePath.split('/').pop() || path.relativePath;
		const { name, year, imdbId } = LibraryService.parseNamePieces(folderName);
		const children = await DirectoryService.listDirectory(path);

		// Take care of series and movies first
		if (year) {
			// Search for "Season" folders
			const allSeasonFolders = children.folders.filter((folder) => folder.name.toLowerCase().includes('season'));
			if (allSeasonFolders.length > 0) {
				return {
					type: 'cinema',
					cinemaType: 'series',
					name,
					year,
					imdbId: imdbId || undefined,
					relativePath: path.relativePath,
					folderName: folderName,
					numSeasons: allSeasonFolders.length,
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
				const { version: movieVersion } = LibraryService.parseNamePieces(movieFile.name);

				const moviePlayable: MoviePlayable = {
					type: 'movie',
					name,
					year,
					version: movieVersion,
					fileName: movieFile.name,
					relativePath: movieFile.confirmedPath.relativePath,
					confirmedPath: movieFile.confirmedPath,
				};

				return {
					type: 'cinema',
					cinemaType: 'movie',
					name,
					year,
					imdbId: imdbId || undefined,
					relativePath: path.relativePath,
					folderName: folderName,
					movie: moviePlayable,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				};
			}
		}


		// Identify an album if all children are audio files
		const allChildrenAreAudio = children.files.length > 0 && children.files.every((file) => AudioTypes.includes(file.name.split('.').pop() as AudioType));
		if (allChildrenAreAudio) {
			const firstTrackProbe = await ProbeService.getTrackData(children.files[0].confirmedPath);
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
					confirmedPath: path,
					folderName: folderName,
					sortKey: LibraryService.createSortKey(folderName, firstTrackProbe?.year),
					name: firstTrackProbe?.album || name,
					listName: firstTrackProbe?.album || name,
					fileName: path.absolutePath,
					chapterStrategy: isMb4b ? 'chapters' : 'tracks',
				}
			}
			else return {
				type: 'album',
				title: firstTrackProbe?.album,
				artist: firstTrackProbe?.album_artist || firstTrackProbe?.artist,
				genre: firstTrackProbe?.genre,
				cover_thumb: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=300`,
				cover: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=500`,
				relativePath: path.relativePath,
				confirmedPath: path,
				folderName: folderName,
				sortKey: LibraryService.createSortKey(folderName),
				name: firstTrackProbe?.album || name,
				listName: firstTrackProbe?.album || name,
				fileName: path.absolutePath,
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
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
				}
			}
		}


		// Find feedOrder if specified in the folder name like ".feedorder-1"
		const feedOrderMatch = folderName.match(/\.feedorder-(\d{1,2})/);
		const feedOrder = feedOrderMatch ? parseInt(feedOrderMatch[1]) : null;


		// If all children folders are media, consider it a collection
		const allChildrenAreMedia = children.folders.length > 0 && children.folders.every((folder) => Boolean(LibraryService.parseNamePieces(folder.name).year));
		if (allChildrenAreMedia) {
			const childrenPaths = children.folders.map((folder) => folder.confirmedPath.relativePath);
			return {
				type: 'collection',
				name,
				relativePath: path.relativePath,
				folderName: folderName,
				feedOrder,
				sortKey: LibraryService.createSortKey(folderName),
				listName: name,
			};
		}

		return {
			type: 'folder',
			name,
			relativePath: path.relativePath,
			folderName: folderName,
			feedOrder,
			listName: name,
			sortKey: LibraryService.createSortKey(folderName),
		};
	}


	private static async joinLibraryItemDetails(path: ConfirmedPath, item: Full<LibraryItemStrat>): Promise<Full<LibraryItemStrat>> {
		const childrenDir = await DirectoryService.listDirectory(path);
		let details: LibraryItemStrat['details'] | undefined = this.itemDetailCache.get(path.relativePath);

		if (!details) {
			details = {};

			// Search for "Season" folders
			if (item.type === 'cinema' && item.cinemaType === 'series') {
				const allSeasonFolders = childrenDir.folders.filter((folder) => folder.name.toLowerCase().includes('season'));
				details = {
					extras: await LibraryService.prepareExtras(childrenDir.files.map((file) => file.name), path),
					seasons: await LibraryService.extractSeasons(allSeasonFolders.map((folder) => folder.confirmedPath), item.name, item.year)
				};
			}
			else if (item.type === 'cinema' && item.cinemaType === 'movie') {
				const extraVideos = childrenDir.files.filter((file) => file.confirmedPath.relativePath !== item.movie.relativePath);
				details = {
					extras: await LibraryService.prepareExtras(extraVideos.map((file) => file.name), path)
				}
			}
			else if (item.type === 'audiobook' || item.type === 'album') {
				const tracks = await Promise.all(childrenDir.files.map(async (file) => {
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
				}));

				// Compute the start offset for each track
				tracks.reduce((acc, track) => {
					track.startOffset = acc;
					acc += track.duration;
					return acc;
				}, 0);

				details = {
					tracks: item.type === 'album' ? tracks : undefined,
					chapters: item.type === 'audiobook' ? tracks.flatMap((track) => {
						if (item.chapterStrategy === 'tracks' || !track.chapters || track.chapters.length === 0) {
							return {
								...track,
								trackDuration: track.duration,
								chapterDuration: track.duration,
								bookStartOffset: track.startOffset || 0,
								trackStartOffset: 0,
							}
						}
						return track.chapters.map((chapter: any) => ({
							...track,
							title: chapter['TAG:title'] || track.title,
							trackDuration: track.duration,
							chapterDuration: chapter.duration,
							bookStartOffset: chapter.start_time || 0,
							trackStartOffset: chapter.start_time || 0,
						}));
					}) : undefined,
				}
			}
			else if (item.type === 'collection') {
				const childrenPaths = childrenDir.folders.map((folder) => folder.confirmedPath.relativePath);
				// Allow collections to have extras - video files at the root of the collection folder
				const extraVideos = childrenDir.files.filter((file) => !childrenPaths.includes(file.confirmedPath.relativePath));
				details = {
					extras: await LibraryService.prepareExtras(extraVideos.map((file) => file.name), path),
				};
			}

			this.itemDetailCache.set(path.relativePath, details as any);
		}


		return {
			...item,
			...details,
		};
	}


	private static async joinLibraryItemMetadata(path: ConfirmedPath, item: Full<LibraryItemStrat>, detailed = false): Promise<Full<LibraryItemStrat>> {
		// Take care of series and movies first
		if (item.type === 'cinema') {
			return {
				...item,
				metadata: await MediaMetadataService.getMetadata(item.cinemaType, path, detailed, true),
			};
		}

		return {
			...item,
			metadata: null,
		}
	}

	/** Many library items have nested Playable items. This will find watchProgress for all of them. */
	private static async joinProgressDeep(item: Record<any, any>) {
		const diveAttributes = ['movie', 'extras', 'seasons', 'episodeFiles', 'episodes', 'chapters', 'tracks'];
		// All items with watchProgress have confirmedPath
		if (item.confirmedPath) {
			item.watchProgress = await WatchProgressService.getWatchProgress(item.confirmedPath);
		}
		await Promise.all(Array.from(Object.keys(item)).map(async key => {
			if (diveAttributes.includes(key) && item[key]) {
				if (Array.isArray(item[key])) {
					await Promise.all(item[key].map(LibraryService.joinProgressDeep));
				}
				else await LibraryService.joinProgressDeep(item[key]);
			}
		}));
	}


	public static async parseFileToItem(path: ConfirmedPath): Promise<LibraryFile | null> {
		const key = `${path.relativePath}`;
		let cached = this.fileCache.get(key);
		if (!cached) {
			const item = await this.computeFileToItem(path);
			cached = item || null;
			this.fileCache.set(path.relativePath, item);
		}
		return cached;
	}
	private static async computeFileToItem(path: ConfirmedPath): Promise<LibraryFile | null> {
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

	public static async reloadLibraryItemData(path: ConfirmedPath) {
		// make sure new compute is successful before wiping cache
		const libraryItem = await this.computeFolderToItem(path);
		if (libraryItem) {
			this.itemCache.delete(path.relativePath);
			this.itemCache.set(path.relativePath, libraryItem)
			this.itemDetailCache.delete(path.relativePath);
			return await this.parseFolderToItem(path, true);
		}
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
		return libraries.filter((library) => library.libraryItem?.type === 'library').map((library) => library.libraryItem) as Full<LibraryStrat>[];
	}


	public static async getFlatTree(path: ConfirmedPath) {
		const items: Array<Base<LibraryItemStrat>> = [];
		const files: Array<LibraryFile> = [];
		async function parseDirectory(confirmedPath: ConfirmedPath) {
			const { folders, files: childrenFiles } = await DirectoryService.listDirectory(confirmedPath);
			const libraryItem = await LibraryService.parseFolderToItem(confirmedPath);
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


	private static async extractSeasons(seasonFolders: Array<ConfirmedPath>, seriesName: string, year: string) {
		const seasons = new Map<number, Season>();

		await Promise.all(seasonFolders.map(async (folderPath) => {
			const { files } = await DirectoryService.listDirectory(folderPath);
			const videoFiles = files.filter((file) => file.name.endsWith('.mp4'));

			const folderSeasonNumber = parseInt(folderPath.relativePath.split('/').pop()?.replace(/season /gi, '') || '');

			const episodes: EpisodeFile[] = [];
			const extraFiles: typeof videoFiles = [];

			const NumbersRegex = RegExp(/s(?<seasonNumber>\d{1,3})e(?<firstEpisodeNumber>\d{1,3})/g);

			const createEpisode = async (file: typeof videoFiles[0], numbersMatch: NonNullable<NonNullable<ReturnType<typeof NumbersRegex.exec>>['groups']>) => {
				// const overAllWatchProgress = await WatchProgressService.getWatchProgress(file.confirmedPath);
				const epFileProbe = await ProbeService.getProbeData(file.confirmedPath);

				const seasonNumber = parseInt(numbersMatch.seasonNumber);
				const firstEpisodeNumber = parseInt(numbersMatch.firstEpisodeNumber);

				const multipleEpisodesRegex = RegExp(/-e(?<episodeNumber>\d{1,3})/g);
				const lastEpisodeNumber = multipleEpisodesRegex.exec(file.name)?.groups?.episodeNumber;

				const episodeTimesRegex = RegExp(/.e(?<episodeNumber>\d{1,3})-(?<startTime>\d{1,50})/g);
				const timesMatch = Array.from(file.name.matchAll(episodeTimesRegex));
				const extraEpisodeTimes = timesMatch?.map((match) => ({
					episodeNumber: parseInt(match.groups?.episodeNumber || '0'),
					startTime: parseInt(match.groups?.startTime || '0'),
				}))?.sort((a, b) => a.episodeNumber - b.episodeNumber);

				const hasMultipleEpisodes = lastEpisodeNumber !== undefined;
				const hasEpisodeTimes = extraEpisodeTimes?.length > 0;

				// function computeEpisodeWatchProgress(
				// 	episodeStartTime: number,
				// 	nextEpisodeStartTime: number | undefined,
				// 	watchProgress: WatchProgress | null
				// ): WatchProgress | null {
				// 	if (!watchProgress) {
				// 		return null;
				// 	}
				// 	if (watchProgress.time < episodeStartTime) {
				// 		return null;
				// 	}

				// 	const watchTime = watchProgress.time - episodeStartTime;
				// 	const totalFileDuration = watchProgress.duration;
				// 	const epsiodeDuration = (nextEpisodeStartTime || totalFileDuration) - episodeStartTime;
				// 	const percentage = Math.min(watchTime / epsiodeDuration, 1) * 100;

				// 	// Remember that only the percentage is made relative to the episode
				// 	return {
				// 		...watchProgress,
				// 		percentage: Math.round(percentage),
				// 	};
				// }

				const allEpisodeTimes = [
					{ episodeNumber: firstEpisodeNumber, startTime: 0 },
					...(extraEpisodeTimes || []),
				]

				const { version } = LibraryService.parseNamePieces(file.name);
				const episodeName = `S${seasonNumber}:E${firstEpisodeNumber}`;
				const episodes: Episode[] = allEpisodeTimes.map(({ episodeNumber, startTime }, i) => ({
					name: episodeName,
					type: 'episode',
					seriesName,
					year,
					version,
					fileName: file.name,
					relativePath: file.confirmedPath.relativePath,
					confirmedPath: file.confirmedPath,

					seasonNumber,
					episodeNumber,
					startTime,
				}));

				return {
					type: 'episodeFile',
					seriesName,
					year,
					hasMultipleEpisodes,
					seasonNumber,
					firstEpisodeNumber,
					fileName: file.name as string,
					relativePath: file.confirmedPath.relativePath,
					duration: epFileProbe?.full.format?.duration,
					episodes,
					name: lastEpisodeNumber ? `Episodes ${firstEpisodeNumber} - ${Number(lastEpisodeNumber)}` : episodeName,
				} as EpisodeFile;
			}

			await Promise.all(videoFiles.map(async (file) => {
				const numbersMatch = RegExp(/s(?<seasonNumber>\d{1,3})e(?<firstEpisodeNumber>\d{1,3})/g).exec(file.name)?.groups;
				if (!numbersMatch) {
					extraFiles.push(file);
				}
				else {
					episodes.push(await createEpisode(file, numbersMatch))
				}
			}));

			const extras = await this.prepareExtras(extraFiles.map(f => f.name), folderPath);
			const seasonRecord = seasons.get(folderSeasonNumber) || {
				seasonNumber: folderSeasonNumber,
				episodeFiles: [],
				extras: [],
			}
			seasonRecord.extras = extras;
			seasons.set(folderSeasonNumber, seasonRecord);

			// Just in case an episode is put in the wrong season folder but its name has the correct number
			episodes.forEach(e => {
				const seasonRecord = seasons.get(e.seasonNumber) || {
					seasonNumber: e.seasonNumber,
					episodeFiles: [],
					extras: [],
				}
				seasonRecord.episodeFiles.push(e);
				seasons.set(e.seasonNumber, seasonRecord);
			})
		}));

		// Sort each season's episodes by episode number
		return Array.from(seasons.values()).map((season) => ({
			...season,
			episodeFiles: season.episodeFiles.sort((a, b) => a.firstEpisodeNumber - b.firstEpisodeNumber),
		})).sort((a, b) => a.seasonNumber - b.seasonNumber);
	}

	private static async prepareExtras(fileNames: string[], parentPath: ConfirmedPath): Promise<Extra[]> {
		return await Promise.all(fileNames.filter(p => p.endsWith('.mp4')).map(async (file) => {
			const { name: extraName, type: extraType } = LibraryService.getExtraNameAndType(file);
			return {
				type: 'extra',
				name: extraName,
				extraType,
				fileName: file,
				relativePath: parentPath.append(file).relativePath,
				confirmedPath: parentPath.append(file),
				// watchProgress: await WatchProgressService.getWatchProgress(parentPath.append(file)),
				still_thumb: `/thumb/${parentPath.append(file).relativePath}?width=300`
			}
		}));
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
			if ('extras' in parentLibrary) {
				playable = (parentLibrary.extras as unknown as Array<Extra>)?.find((extra) => path.relativePath === extra.relativePath) || null;
			}
			if (!playable && 'movie' in parentLibrary) {
				playable = (parentLibrary as Base<MovieCinemaStrat>).movie.relativePath === path.relativePath ? parentLibrary.movie : null;
			}
			if (!playable && parentLibrary.type === 'cinema' && parentLibrary.cinemaType === 'series') {
				playable = (parentLibrary as Full<SeriesCinemaStrat>).seasons?.flatMap((season) => season.episodeFiles).find((episodeFile) => path.relativePath === episodeFile.relativePath) || null;
			}
		}
		if (!playable) {
			playable = await LibraryService.parseFolderToItem(path) as AnyPlayable;
		}


		if (!playable) {
			console.warn(`No playable found for ${path.relativePath}`);
			return {
				parentLibrary,
			};
		}
		return {
			parentLibrary,
			playable: playable as AnyPlayable,
		}
	}

	public static async getNextEpisode(path: ConfirmedPath) {
		const { parentLibrary, playable } = await LibraryService.getLibraryForPlayable(path);
		if (!parentLibrary || !playable || playable.type !== 'episodeFile') {
			return null;
		}
		const allEpisodes = (parentLibrary as Full<SeriesCinemaStrat>).seasons?.flatMap((season) => season.episodeFiles).flatMap((episodeFile) => episodeFile.episodes);
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

	private static async determineMediaTypeInLibrary(path: ConfirmedPath): Promise<Base<LibraryStrat>['libraryType'] | null> {
		// recursivle search for first descendent that matches a media description
		async function findMediaWithin(path: ConfirmedPath): Promise<Base<LibraryStrat>['libraryType'] | null> {
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
			return null;
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
