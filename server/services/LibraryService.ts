/**
 * Parses file system into directories of media.
 */

import { objectOrder } from "../utils/miscUtils";
import { AbsolutePath, ConfirmedPath, DirectoryService, RelativePath } from "./DirectoryService";
import { Loan, LoanService } from "./LoanService";
import { MediaMetadataService } from "./metadata/MetadataService";
import { EitherMetadata } from "./metadata/MetadataTypes";
import { ProbeService } from "./ProbeService";
import { SurpriseRecord, SurpriseService } from "./SurpriseService";
import { Bookmark, WatchProgress, WatchProgressService } from "./WatchProgressService";

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
		libraryTier: 'directory' | 'title' | 'title-directory' | 'content-file',
		folderName: string,
		relativePath: RelativePath,
		listName: string,
		sortKey: string,
		imdbId?: string,
		poster?: string,
	},
	{},
	{
		metadata?: EitherMetadata | null,
		loan?: Loan | null,
		surprise: SurpriseRecord | null,
		children: Array<RelativePath>,
	}
>

type ContentFileBase = {
	libraryTier: 'content-file',
	fileName?: string,
	relativePath: RelativePath,
}


/**
 * TitleContent must reference a file, and must have a parent "title".
 * To keep the code simple, we will require that a Content item must always
 * live within a dedicated "Title" folder even if there is no other content.
 * I.E. A single audiobook file
 * 
 * TitleContent is differentiated from Gallery content because gallery items don't need to live under a Title
 */
export type TitleContent = {
	libraryTier: 'content-file',
	type: 'movie' | 'episodeFile' | 'episode' | 'extra' | 'album' | 'audiobook' | 'track' | 'chapter',
	name: string,
	year?: string,
	seriesName?: string, // i.e. "Harry Potter" or "Friends"
	seasonNumber?: number,
	episodeNumber?: number,
	version?: string | null,
	fileName?: string,
	relativePath: RelativePath,
	confirmedPath: ConfirmedPath,
	watchProgress?: WatchProgress | null,
	duration?: number,
	listName?: string,
	sortKey?: string,
}

/**
 * Some content types like Audiobooks or EpisodeFile contains multiple separate tracks,
 * like chapters or multiple episodes in a single file.
 * The segments can either be identified by chapters metadata or by file name metadata
 */
type ContentSegment = {

}

const ExtraTypes = ['behindthescenes', 'deleted', 'featurette', 'short', 'trailer', 'musicvideo'] as const;
type ExtraType = typeof ExtraTypes[number];
type Extra = TitleContent & {
	type: 'extra',
	extraType: ExtraType | null,
	still_thumb: string,
}

type CinemaItemStrat = Join<LibraryItemStratBase, Stratified<
	{
		libraryTier: 'title',
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
	movie: MovieContent,
}>>

type MovieContent = TitleContent & {
	type: 'movie',
	name: string,
	year: string,
}



/* A single file may span multiple episodes.
 * For simplicity represent all as any array even if they have just one
*/
type EpisodeFile = TitleContent & {
	type: 'episodeFile',
	seriesName: string,
	year: string,
	seasonNumber: number,
	firstEpisodeNumber: number,
	hasMultipleEpisodes: boolean,
	episodes: Array<Episode>,
}

type Episode = TitleContent & {
	type: 'episode',
	seriesName: string,
	year: string,
	seasonNumber: number,
	episodeNumber: number,
	startTime?: number,
}

type Season = {
	libraryTier: 'title-directory',
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
		libraryTier: 'title',
		type: 'album',
		title?: string,
		year?: string,
		artist?: string,
		genre?: string,
		cover_thumb: string,
		cover: string,
	},
	{
		tracks?: Array<AudioTrack>,
		totalRuntime_s: number,
	}
>>

type AudioTrack = TitleContent & {
	title?: string,
	artist?: string,
	album?: string,
	trackNumber?: number,
	trackTotal?: number,
	discNumber?: number,
	discTotal?: number,
	duration?: number,
	sortKey: string,
	titleStartOffset: number,
	trackSegments?: Array<{
		title?: string,
		duration: number,
		start_s: number,
		end_s: number,
		titleStartOffset: number,
	}>
}

type AudiobookStrat = Join<LibraryItemStratBase, Stratified<
	{
		libraryTier: 'title',
		type: 'audiobook',
		title?: string,
		year?: string,
		author?: string,
		cover_thumb: string,
		cover: string,
		confirmedPath: ConfirmedPath,
	},
	{
		bookmarks: Array<Bookmark>,
		tracks?: Array<AudioTrack>,
		// A flattened array of all chapters, either from an entire track or from track segments
		chapters?: Array<Chapter>,
		totalRuntime_s: number,
	}
>>

type Chapter = {
	id: string,
	title?: string,
	relativePath: RelativePath,
	trackDuration: number,
	duration: number,
	titleStartOffset: number,
	start_s: number,
	end_s: number,
}

export type AnyContent = MovieContent | Episode | EpisodeFile | Base<AlbumStrat> | Base<AudiobookStrat> | Extra;

/** A collection is a specific group of media, like a movie series i.e. Harry Potter */
type CollectionStrat = Join<LibraryItemStratBase, Stratified<
	{
		libraryTier: 'directory',
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
		libraryTier: 'directory',
		type: 'folder',
		feedOrder: number | null,
		name: string,
	}
>>

/** A library is a root-level entity containing all of one type of media */
type LibraryStrat = Join<LibraryItemStratBase, Stratified<
	{
		libraryTier: 'directory',
		type: 'library',
		libraryType: 'cinema' | 'photos' | 'audio',
		name: string,
		confirmedPath: ConfirmedPath,
	}
>>

type LibraryItemStrat = MovieCinemaStrat | SeriesCinemaStrat | AlbumStrat | AudiobookStrat | CollectionStrat | FolderStrat | LibraryStrat;




type GalleryFileData = ContentFileBase & {
	listName: string,
	sortKey: string,
}

export const PhotoTypes = ['jpg', 'jpeg', 'png', 'gif'] as const;
type PhotoType = typeof PhotoTypes[number];
export type Photo = GalleryFileData & {
	type: 'photo',
	fileType: PhotoType,
	takenAt?: string,
}

export const VideoTypes = ['mp4', '3gp', '3g2', 'mkv'] as const;
type VideoType = typeof VideoTypes[number];
type Video = GalleryFileData & {
	type: 'video',
	fileType: VideoType,
	takenAt?: string,
}

export const AudioTypes = ['mp4', 'mp3', 'm4a', 'm4b', 'aac', 'flac'] as const;
type AudioType = typeof AudioTypes[number];
type Audio = GalleryFileData & {
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

type GalleryFile = Photo | Video | Audio;

export class LibraryService {
	static readonly itemCache = new Map<string, Base<LibraryItemStrat>>();
	static readonly itemDetailCache = new Map<string, LibraryItemStrat['details']>();
	static readonly fileCache = new Map<string, ContentFileBase | null>();

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
			loan: await LoanService.getLoan(path.relativePath),
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

		const posterFile = children.files.find(f => f.name.includes('poster.'));
		const posterPath = posterFile ? '/media/' + posterFile.confirmedPath.relativePath : undefined;

		// Take care of series and movies first
		if (year) {
			// Search for "Season" folders
			const allSeasonFolders = children.folders.filter((folder) => folder.name.toLowerCase().includes('season'));
			if (allSeasonFolders.length > 0) {
				return {
					libraryTier: 'title',
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
					poster: posterPath,
				};
			}

			// Identify movie when a child item has the same name and year
			const movieFile = children.files.find((file) => {
				const { name: mediaName, year: fileYear } = LibraryService.parseNamePieces(file.name);
				return VideoTypes.includes(file.name.split('.').pop() as any) && mediaName === name && fileYear === year;
			});
			if (movieFile) {
				const movieContent: MovieContent = this.createMovieContent(movieFile.confirmedPath)!;

				return {
					libraryTier: 'title',
					type: 'cinema',
					cinemaType: 'movie',
					name,
					year,
					imdbId: imdbId || undefined,
					relativePath: path.relativePath,
					folderName: folderName,
					movie: movieContent,
					sortKey: LibraryService.createSortKey(folderName),
					listName: name,
					poster: posterPath,
				};
			}
		}

		// Find feedOrder if specified in the folder name like ".feedorder-1"
		const feedOrderMatch = folderName.match(/\.feedorder-(\d{1,3})/);
		const feedOrder = feedOrderMatch ? parseInt(feedOrderMatch[1]) : null;


		// If any children folders are cinema, consider it a cinema collection
		const cinemaFolder = children.folders.find((folder) => Boolean(LibraryService.parseNamePieces(folder.name).year));
		if (Boolean(cinemaFolder)) {
			// const childrenPaths = children.folders.map((folder) => folder.confirmedPath.relativePath);
			return {
				libraryTier: 'directory',
				type: 'collection',
				name,
				relativePath: path.relativePath,
				folderName: folderName,
				feedOrder,
				sortKey: LibraryService.createSortKey(folderName),
				listName: name,
			};
		}


		// A folder named "Season N" whose parent has name+year components is a cinema season,
		// not an album — even if all its children are .mp4 files.
		const isSeasonFolder = /^season\s+\d/i.test(folderName);
		if (isSeasonFolder) {
			const parentFolderName = path.relativePath.split('/').slice(0, -1).pop() || '';
			const { year: parentYear } = LibraryService.parseNamePieces(parentFolderName);
			if (parentYear) {
				return {
					libraryTier: 'directory',
					type: 'folder',
					name: folderName,
					relativePath: path.relativePath,
					folderName: folderName,
					feedOrder: null,
					listName: folderName,
					sortKey: LibraryService.createSortKey(folderName),
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
					libraryTier: 'title',
					type: 'audiobook',
					title: firstTrackProbe?.album,
					author: firstTrackProbe?.album_artist || firstTrackProbe?.artist,
					year: firstTrackProbe?.year ? String(firstTrackProbe?.year) : undefined,
					cover_thumb: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=300`,
					cover: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=500`,
					confirmedPath: path,
					relativePath: path.relativePath,
					// confirmedPath: path,
					folderName: folderName,
					sortKey: LibraryService.createSortKey(folderName, firstTrackProbe?.year),
					// name: firstTrackProbe?.album || name,
					listName: firstTrackProbe?.album || name,
					// fileName: path.absolutePath,
					poster: posterPath,
				}
			}
			else return {
				libraryTier: 'title',
				type: 'album',
				title: firstTrackProbe?.album,
				artist: firstTrackProbe?.album_artist || firstTrackProbe?.artist,
				genre: firstTrackProbe?.genre,
				year: firstTrackProbe?.year ? String(firstTrackProbe?.year) : undefined,
				cover_thumb: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=300`,
				cover: `/thumb/${path.relativePath + '/' + children.files[0].name}?width=500`,
				relativePath: path.relativePath,
				// confirmedPath: path,
				folderName: folderName,
				sortKey: LibraryService.createSortKey(folderName),
				// name: firstTrackProbe?.album || name,
				listName: firstTrackProbe?.album || name,
				// fileName: path.absolutePath,
				poster: posterPath,
			};
		}

		// Root Libraries
		if (path.relativePath.split('/').length === 1) {
			// The library type will be determined by the type of files at its leaf nodes
			const mediaType = await LibraryService.determineMediaTypeInLibrary(path);
			if (mediaType) {
				return {
					libraryTier: 'directory',
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

		return {
			libraryTier: 'directory',
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
					extras: LibraryService.prepareExtras(childrenDir.files.map((file) => file.confirmedPath)),
					seasons: await LibraryService.extractSeasons(allSeasonFolders.map((folder) => folder.confirmedPath), item.name, item.year)
				};
			}
			else if (item.type === 'cinema' && item.cinemaType === 'movie') {
				const extraVideos = childrenDir.files.filter((file) => file.confirmedPath.relativePath !== item.movie.relativePath);
				details = {
					extras: LibraryService.prepareExtras(extraVideos.map((file) => file.confirmedPath))
				}
			}
			else if (item.type === 'audiobook' || item.type === 'album') {
				let tracks = await Promise.all(childrenDir.files.map(async (file) => {
					const probe = await ProbeService.getTrackData(file.confirmedPath);
					const title = probe?.title || LibraryService.removeExtensionsFromFileName(file.name);
					const track: AudioTrack = {
						libraryTier: 'content-file',
						type: 'track',
						title,
						artist: probe?.artist,
						album: probe?.album,
						year: probe?.year ? String(probe.year) : undefined,
						trackNumber: probe?.trackNumber,
						trackTotal: probe?.trackTotal,
						discNumber: probe?.discNumber,
						discTotal: probe?.discTotal,
						duration: probe?.duration,
						name: title,
						fileName: file.name,
						relativePath: file.confirmedPath.relativePath,
						confirmedPath: file.confirmedPath,
						sortKey: `${String(probe?.discNumber || '').padStart(3, '0')}_${String(probe?.trackNumber || '').padStart(3, '0')}_` + file.name,
						listName: title,
						trackSegments: probe?.chapters?.map(chapter => ({
							...chapter,
							// still to be computed
							titleStartOffset: 0,
						})),
						// still to be computed
						titleStartOffset: 0,
					}
					return track;
				}));

				tracks = objectOrder(tracks, t => t.sortKey);

				// Compute the start offset for each track
				const totalRuntime_s = tracks.reduce((acc, track) => {
					track.titleStartOffset = acc;
					acc += track.duration || 0;

					// Compute the start offset for each track segment
					track.trackSegments?.reduce((segmentAcc, segment) => {
						segment.titleStartOffset = track.titleStartOffset + segmentAcc;
						segmentAcc += segment.duration;
						return segmentAcc;
					}, 0);

					return acc;
				}, 0);

				details = {
					totalRuntime_s,
					tracks,
					chapters: item.type === 'audiobook' ? tracks.flatMap((track) => {
						let chapters: Array<Chapter>;
						if (!track.trackSegments || track.trackSegments.length === 0) {
							chapters = [{
								id: track.relativePath,
								title: track.title || track.fileName,
								relativePath: track.relativePath,
								trackDuration: track.duration || 0,
								duration: track.duration || 0,
								titleStartOffset: track.titleStartOffset,
								start_s: 0,
								end_s: track.duration || 0,
							}]
							return chapters;
						}
						chapters = track.trackSegments.map(chapter => ({
							...chapter,
							id: track.relativePath + '_' + chapter.duration,
							relativePath: track.relativePath,
							trackDuration: track.duration || 0,
						}));
						return chapters;
					}) : undefined,
				}
			}
			else if (item.type === 'collection') {
				const childrenPaths = childrenDir.folders.map((folder) => folder.confirmedPath.relativePath);
				// Allow collections to have extras - video files at the root of the collection folder
				const extraVideos = childrenDir.files.filter((file) => !childrenPaths.includes(file.confirmedPath.relativePath));
				details = {
					extras: LibraryService.prepareExtras(extraVideos.map((file) => file.confirmedPath)),
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

	/** Many library items have nested Content items. This will find watchProgress for all of them. */
	private static async joinProgressDeep(item: Record<any, any>) {
		const diveAttributes = ['movie', 'extras', 'seasons', 'episodeFiles', 'episodes', 'tracks'];
		// All items with watchProgress have confirmedPath
		if (item.libraryTier === 'content-file') {
			item.watchProgress = await WatchProgressService.getWatchProgress(item.confirmedPath);
		}
		if (item.type === 'audiobook') {
			item.bookmarks = await WatchProgressService.getBookmarksForTitle(item.confirmedPath);
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


	public static async parseFileToContentItem(path: ConfirmedPath): Promise<ContentFileBase | null> {
		const key = `${path.relativePath}`;
		let cached = this.fileCache.get(key) || null;
		if (!cached) {
			const item = await this.computeFileToItem(path);
			if (item) {
				cached = item || null;
				this.fileCache.set(path.relativePath, item);
			}
		}
		return cached;
	}

	private static async computeFileToItem(path: ConfirmedPath): Promise<ContentFileBase | null> {
		const { name, year } = this.parseNamePieces(path.relativePath);
		if (name && year) {
			return this.createMovieContent(path);
		}
		const { type: extraType } = this.getExtraNameAndType(path.relativePath);
		if (extraType) {
			const extraFile = this.prepareExtras([path])[0] || null;
			if (extraFile) {
				return extraFile;
			}
		}
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
		} as GalleryFile;
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
		const files: Array<ContentFileBase> = [];
		async function parseDirectory(confirmedPath: ConfirmedPath) {
			const { folders, files: childrenFiles } = await DirectoryService.listDirectory(confirmedPath);
			const libraryItem = await LibraryService.parseFolderToItem(confirmedPath);
			if (libraryItem) {
				items.push(libraryItem);
			}
			await Promise.all(childrenFiles.map(async (file) => {
				const fileItem = await LibraryService.parseFileToContentItem(file.confirmedPath);
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
			const videoFiles = files.filter((file) => VideoTypes.some(t => file.confirmedPath.relativePath.endsWith(t)));

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
					libraryTier: 'content-file',
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
					still_thumb: `/thumb/${file.confirmedPath.relativePath}?width=300&seek=${startTime + 3}`
				}));

				const episodeFile: EpisodeFile = {
					libraryTier: 'content-file',
					type: 'episodeFile',
					seriesName,
					year,
					hasMultipleEpisodes,
					seasonNumber,
					firstEpisodeNumber,
					fileName: file.name as string,
					confirmedPath: file.confirmedPath,
					relativePath: file.confirmedPath.relativePath,
					duration: epFileProbe?.full.format?.duration,
					episodes,
					name: lastEpisodeNumber ? `Episodes ${firstEpisodeNumber} - ${Number(lastEpisodeNumber)}` : episodeName,
				}

				return episodeFile;
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

			const extras = await this.prepareExtras(extraFiles.map(f => f.confirmedPath));
			const seasonRecord = seasons.get(folderSeasonNumber) || {
				libraryTier: 'title-directory',
				seasonNumber: folderSeasonNumber,
				episodeFiles: [],
				extras: [],
			}
			seasonRecord.extras = extras;
			seasons.set(folderSeasonNumber, seasonRecord);

			// Just in case an episode is put in the wrong season folder but its name has the correct number
			episodes.forEach(e => {
				const seasonRecord = seasons.get(e.seasonNumber) || {
					libraryTier: 'title-directory',
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

	private static prepareExtras(filePaths: Array<ConfirmedPath>): Extra[] {
		return filePaths.filter(p => p.relativePath.endsWith('.mp4')).map((filePath) => {
			const { name: extraName, type: extraType } = LibraryService.getExtraNameAndType(filePath.relativePath);
			return {
				libraryTier: 'content-file',
				type: 'extra',
				name: extraName,
				extraType,
				relativePath: filePath.relativePath,
				confirmedPath: filePath,
				// watchProgress: await WatchProgressService.getWatchProgress(parentPath.append(file)),
				still_thumb: `/thumb/${filePath.relativePath}?width=300&seek=3`
			}
		});
	}

	public static getTitlePath(relativePath: string) {
		// title right now is always the parent folder OR grandparent if parent is season
		const ancestry = relativePath.split('/');
		const parentIdx = ancestry.length - 2;
		const grandparentIdx = ancestry.length - 3;

		const titleIndex = ancestry[parentIdx].toLowerCase().match(/^season \d/g) ? grandparentIdx : parentIdx;
		return ancestry.slice(0, titleIndex + 1).join('/');
	}

	public static async getLibraryForContentFile(filePath: ConfirmedPath) {
		if (DirectoryService.isFolder(filePath)) {
			console.error('Content file cannot be a folder!');
			return null;
		}
		let content: ContentFileBase | null = null;

		const ancestors = filePath.relativePath.split('/').slice(0, -1).reduce((paths, thisPath) => {
			const lastPath = paths[paths.length - 1];
			const currentPath = lastPath ? lastPath.append(thisPath) : DirectoryService.resolvePath(thisPath)!;
			return [...paths, currentPath];
		}, [] as Array<ConfirmedPath>);

		let parentTitle;

		// find parent title by moving through parents until finding a folder of libraryTier 'title'
		// the parent title MUST be a folder and not the file itself
		for (const ancestor of ancestors) {
			const item = await LibraryService.parseFolderToItem(ancestor, true, true);
			if (item && item.libraryTier === 'title') {
				parentTitle = item;
				break;
			}
		}

		// if there is no parent folder that is a 'title', the content is just a gallery file
		if (!parentTitle) {
			content = await LibraryService.parseFileToContentItem(filePath);
		}

		// otherwise, TitleContent items are currently computed in the details of the parent tile.
		// This could be revisited, it's not the best lookup strategy
		if (parentTitle) {
			// Identify content within the parent library
			if ('extras' in parentTitle) {
				content = (parentTitle.extras as unknown as Array<Extra>)?.find((extra) => filePath.relativePath === extra.relativePath) || null;
			}
			if (!content && 'seasons' in parentTitle) {
				content = (parentTitle as Full<SeriesCinemaStrat>).seasons?.flatMap(s => s.extras).find((extra) => filePath.relativePath === extra.relativePath) || null;
			}
			if (!content && 'movie' in parentTitle && (parentTitle as Base<MovieCinemaStrat>).movie.relativePath === filePath.relativePath) {
				content = parentTitle.movie;
			}
			if (!content && parentTitle.type === 'cinema' && parentTitle.cinemaType === 'series') {
				content = (parentTitle as Full<SeriesCinemaStrat>).seasons?.flatMap((season) => season.episodeFiles).find((episodeFile) => filePath.relativePath === episodeFile.relativePath) || null;
			}
			if (!content && 'tracks' in parentTitle) {
				content = (parentTitle as Full<AlbumStrat>).tracks?.find((track) => filePath.relativePath === track.relativePath) || null;
			}
		}


		if (!content) {
			console.warn(`No content file found for ${filePath.relativePath}`);
			return null;
		}
		return {
			parentTitle,
			content: content as AnyContent,
		}
	}

	public static async getNextEpisode(path: ConfirmedPath) {
		const { parentTitle, content } = (await LibraryService.getLibraryForContentFile(path)) || {};
		if (!parentTitle || !content || content.type !== 'episodeFile') {
			return null;
		}
		const allEpisodes = (parentTitle as Full<SeriesCinemaStrat>).seasons?.flatMap((season) => season.episodeFiles).flatMap((episodeFile) => episodeFile.episodes);
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

	private static createMovieContent(path: ConfirmedPath): MovieContent | null {
		const { name, year, version } = this.parseNamePieces(path.relativePath);
		if (!name || !year) {
			return null;
		}

		return {
			libraryTier: 'content-file',
			type: 'movie',
			name,
			year,
			version,
			relativePath: path.relativePath,
			confirmedPath: path,
		};
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
		// make sure we're dealing with just a file name, not a full path
		const justName = filename.split('/').pop()!;
		// Extensions are everything after a '.' AFTER any spaces
		// Regexp for extension: a . followed by anything other than a space
		return justName.split(RegExp(/\.[\S]{1,50}/g))[0] || filename;
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
				if (PhotoTypes.some(a => file.name.endsWith(a))) {
					return 'photos';
				}
				if (AudioTypes.some(a => file.name.endsWith(a))) {
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

	public static createSortKey(folderName: string, providedYear?: string | number) {
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
