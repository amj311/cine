/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { Store } from "./DataService";
import { ConfirmedPath, DirectoryService, RelativePath } from "./DirectoryService";
import { LibraryService } from "./LibraryService";
import { getSessionEmail } from "./SessionService";

export type WatchProgress = {
	time: number,
	duration: number,
	percentage: number,
	watchedAt: number,
	relativePath: RelativePath,
}

/**
 * Bookmarks are saved by the path to a Title, with a WatchProgress for any track within that title
 * Note that this setup will only really work for audiobooks
 */
type BookmarkKeys = {
	id: string,
	titlePath: RelativePath,
	name: string,
}

// A bookmark saves additional timestamps for a media
export type Bookmark = WatchProgress & BookmarkKeys;


/**
 * store all progress by email for a path
 */
type WatchProgressStoreRecord = Record<string, WatchProgress>; // <email, progress>
type BookmarkStoreRecord = Record<string, Record<string, Bookmark>>; // <email, bookmarkId, Bookmark>

const watchingStore = new Store<WatchProgressStoreRecord>('watchProgress'); // <content media path, WatchProgressStoreRecord>
const bookmarkStore = new Store<BookmarkStoreRecord>('bookmarks'); // <title item path, BookmarkStoreRecord>

export class WatchProgressService {
	/**
	 * Sets the current watching progress of a media.
	 * If the media is nearly done, it is considered finished.
	 * If the media is finished, it is removed from the list.
	 * @param path The id of the media.
	 * @param percentage The percentage of the media that has been watched.
	 */
	public static async updateWatchProgress(path: ConfirmedPath, progress: WatchProgress, bookmarkKeys?: BookmarkKeys) {
		if (path.isFolder) {
			throw new Error("Watch progress path must be for a media file!")
		}

		// Always save the overall progress
		const fullProgress: WatchProgress = {
			...progress,
			relativePath: path.relativePath,
		}
		await this.upsertProgressForEmail(fullProgress, getSessionEmail());

		if (bookmarkKeys) {
			// Save the bookmark progress
			const fullBookmark: Bookmark = {
				...progress,
				...bookmarkKeys,
				relativePath: path.relativePath,
			}
			await this.upsertBookmarkForEmail(fullBookmark, getSessionEmail());
		}
	}

	/**
	 * Returns the current watching progress of a media.
	 * @param path The id of the media.
	 * @returns The watching progress of the media.
	 */
	public static async getWatchProgress(path: ConfirmedPath): Promise<WatchProgress | null> {
		const allProgress = (await watchingStore.getByKey(path.relativePath)) || {};
		const progress = allProgress[getSessionEmail()];
		return progress || null;
	}

	private static async upsertProgressForEmail(progress: WatchProgress, email: string) {
		const allProgress = await watchingStore.getByKey(progress.relativePath) || {};
		allProgress[email] = progress;
		await watchingStore.set(progress.relativePath, allProgress);
	}

	public static async deleteWatchProgress(path: ConfirmedPath): Promise<void> {
		const allProgress = await watchingStore.getByKey(path.relativePath) || {};
		delete allProgress[getSessionEmail()];
		await watchingStore.set(path.relativePath, allProgress);
	}

	public static async deleteBookmark(titlePath: ConfirmedPath, bookmarkId: string) {
		const bookmarksForMedia = (await bookmarkStore.getByKey(titlePath.relativePath)) || {};
		const bookmarksForEmail = bookmarksForMedia[getSessionEmail()];
		if (bookmarksForEmail) {
			delete bookmarksForEmail[bookmarkId];
			bookmarksForMedia[getSessionEmail()] = bookmarksForEmail;
			await bookmarkStore.set(titlePath.relativePath, bookmarksForMedia);
		}
	}

	private static async upsertBookmarkForEmail(bookmark: Bookmark, email: string) {
		const allTitleBookmarks = await bookmarkStore.getByKey(bookmark.titlePath) || {};
		const emailBookmarks = allTitleBookmarks[email] || {};
		emailBookmarks[bookmark.id] = bookmark;
		allTitleBookmarks[email] = emailBookmarks;
		await bookmarkStore.set(bookmark.titlePath, allTitleBookmarks);
	}

	public static async getBookmarksForTitle(path: ConfirmedPath) {
		const allTitleBookmarks = await bookmarkStore.getByKey(path.relativePath);
		return allTitleBookmarks?.[getSessionEmail()] || {};
	}


	/** Returns SORTED recently watched items */
	public static async getAllRecentlyWatched(cutoff_ms = 1000 * 60 * 60 * 24 * 30 * 6): Promise<WatchProgress[]> {
		const allProgresses = await watchingStore.getValues();
		const emailProgresses = allProgresses.map(p => p[getSessionEmail()]).filter(Boolean);
		const sorted = emailProgresses.sort((a, b) => {
			return b.watchedAt - a.watchedAt;
		});
		const cutoffIdx = sorted.findIndex(s => s.watchedAt < Date.now() - cutoff_ms);
		return cutoffIdx < 0 ? sorted : sorted.slice(0, cutoffIdx);
	}

	private static isEpisode(relativePath: RelativePath): boolean {
		return relativePath?.toLowerCase().includes("/season ");
	}

	/**
	 * Filters watch list items to only a single episode per series.
	 * Expects that watch list is already sorted!!!!!!! Silly thing to expect
	 * @param list
	 * @returns 
	 */
	private static getLatestPerTitle(list: WatchProgress[]): WatchProgress[] {
		const seenTitles = new Set<string>();
		const filtered = list.filter((item) => {
			let titlePath = LibraryService.getTitlePath(item.relativePath);
			if (seenTitles.has(titlePath)) {
				return false;
			}
			seenTitles.add(titlePath);
			return true;
		});
		return filtered;
	}

	/**
	 * Gathers items that to continue watching.
	 * Only shows the most recently watched episode froma series if there are multiple.
	 */
	public static async getContinueWatchingList() {
		// temp migration
		// drop all items that do not exist or are not files
		const allEntries = await watchingStore.getEntries();
		for (const [path] of allEntries) {
			await watchingStore.delete(path);
		}
		// completely drop all bookmarks
		const allBookmarkEntries = await bookmarkStore.getEntries();
		for (const [path] of allBookmarkEntries) {
			const resolved = DirectoryService.resolvePath(path);
			await bookmarkStore.delete(resolved!.relativePath);
		}

		const recent = await WatchProgressService.getAllRecentlyWatched();
		return WatchProgressService.getLatestPerTitle(recent).filter(i => !WatchProgressService.isFinished(i));
	}

	/**
	 * Finds an episode that is the most recently watched of a series and was also finished.
	 * @param list The list of watched items to check.
	 */
	public static async getLastFinishedEpisodes(cnt = 3): Promise<WatchProgress[]> {
		const recent = await WatchProgressService.getAllRecentlyWatched();
		const episodesOnly = WatchProgressService.getLatestPerTitle(recent).filter((item) => WatchProgressService.isEpisode(item.relativePath));
		const finished = episodesOnly.filter(WatchProgressService.isFinished);
		return finished.slice(0, cnt);
	}

	private static isFinished(progress: WatchProgress) {
		// finished is < 1min remaining or > 90%
		return (progress.duration - progress.time < 60) || progress.percentage > 90;
	}
}
