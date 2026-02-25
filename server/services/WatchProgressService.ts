/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { Store } from "./DataService";
import { ConfirmedPath, RelativePath } from "./DirectoryService";
import { getSessionEmail } from "./SessionService";

export type WatchProgress = {
	time: number,
	duration: number,
	percentage: number,
	watchedAt: number,
	relativePath: RelativePath,
	sub?: {
		relativePath: RelativePath,
		duration: number,
		time: number,
	}
}

// A bookmark saves additional timestamps for a media
export type Bookmark = WatchProgress & {
	name: string,
}

type WatchProgressWithBookmarks = WatchProgress & {
	bookmarks: Bookmark[],
}

// const watching = new Map<RelativePath, WatchProgress>();
// const bookmarks = new Map<RelativePath, Map<string, Bookmark>>();



/**
 * store all progress by email for a path
 */
type WatchProgressStoreRecord = Record<string, WatchProgress>; // <email, progress>
type BookmarkStoreRecord = Record<string, Record<string, Bookmark>>;

const watchingStore = new Store<WatchProgressStoreRecord>('watchProgress');
const bookmarkStore = new Store<BookmarkStoreRecord>('bookmarks');

export class WatchProgressService {
	/**
	 * Sets the current watching progress of a media.
	 * If the media is nearly done, it is considered finished.
	 * If the media is finished, it is removed from the list.
	 * @param path The id of the media.
	 * @param percentage The percentage of the media that has been watched.
	 */
	public static async updateWatchProgress(path: ConfirmedPath, progress: WatchProgress, bookmarkId?: string) {
		// Always save the overall progress
		const fullProgress: WatchProgress = {
			...progress,
			relativePath: path.relativePath,
		}
		await this.upsertProgressForEmail(fullProgress, getSessionEmail());

		if (bookmarkId) {
			// Save the bookmark progress
			const fullBookmark: Bookmark = {
				...progress,
				relativePath: path.relativePath,
				name: bookmarkId,
			}
			await this.upsertBookmarkForEmail(fullBookmark, getSessionEmail());
		}
	}

	/**
	 * Returns the current watching progress of a media.
	 * @param path The id of the media.
	 * @returns The watching progress of the media.
	 */
	public static async getWatchProgress(path: ConfirmedPath): Promise<WatchProgressWithBookmarks | null> {
		const allProgress = (await watchingStore.getByKey(path.relativePath)) || {};
		const progress = allProgress[getSessionEmail()];
		if (progress) {
			const allBookmarks = (await bookmarkStore.getByKey(path.relativePath)) || {};
			const bookmarks = allBookmarks[getSessionEmail()] || {};
			return {
				...progress,
				bookmarks: Array.from(Object.values(bookmarks)),
			}
		}
		return null;
	}

	public static async deleteWatchProgress(path: ConfirmedPath): Promise<void> {
		await watchingStore.delete(path.relativePath);
		await bookmarkStore.delete(path.relativePath);
	}

	public static async deleteBookmark(path: ConfirmedPath, bookmarkId: string) {
		const bookmarksForMedia = await bookmarkStore.getByKey(path.relativePath);
		if (bookmarksForMedia) {
			delete bookmarksForMedia[bookmarkId];
			await bookmarkStore.set(path.relativePath, bookmarksForMedia);
		}
	}

	private static async upsertBookmarkForEmail(bookmark: Bookmark, email: string) {
		const allBookmarks = await bookmarkStore.getByKey(bookmark.relativePath) || {};
		const emailBookmarks = allBookmarks[email] || {};
		emailBookmarks[bookmark.name] = bookmark;
		await bookmarkStore.set(bookmark.relativePath, allBookmarks);
	}

	private static async upsertProgressForEmail(progress: WatchProgress, email: string) {
		const allProgress = await watchingStore.getByKey(progress.relativePath) || {};
		allProgress[email] = progress;
		await watchingStore.set(progress.relativePath, allProgress);
	}

	public static async getAllRecentlyWatched(): Promise<WatchProgress[]> {
		// await watchingStore.migrate<WatchProgress>((v1) => ({ [getSessionEmail()]: v1.data }));
		// await bookmarkStore.migrate<Record<string, Bookmark>>((v1) => ({ [getSessionEmail()]: v1.data }));

		const allProgresses = await watchingStore.getAll();
		const emailProgresses = allProgresses.map(p => p[getSessionEmail()]).filter(Boolean);
		return (emailProgresses).sort((a, b) => {
			return b.watchedAt - a.watchedAt;
		}).slice(0, 50);
	}

	private static isEpisode(relativePath: RelativePath): boolean {
		return relativePath.toLowerCase().includes("/season ");
	}

	/**
	 * Filters watch list items to only a single episode per series.
	 * @param list
	 * @returns 
	 */
	private static filterOutExtraEpisodes(list: WatchProgress[]): WatchProgress[] {
		const seenSeries = new Set<string>();
		const continueWatching = list.filter((item) => {
			const isEpisode = WatchProgressService.isEpisode(item.relativePath);
			if (!isEpisode) {
				return true;
			}
			let series = item.relativePath.split("/").slice(0, -2).join("/");
			if (seenSeries.has(series)) {
				return false;
			}
			seenSeries.add(series);
			return true;
		});
		return continueWatching;
	}

	/**
	 * Gathers items that to continue watching.
	 * Only shows the most recently watched episode froma series if there are multiple.
	 */
	public static async getContinueWatchingList() {
		const recent = await WatchProgressService.getAllRecentlyWatched();
		return WatchProgressService.filterOutExtraEpisodes(recent).filter((item) => {
			// must be < 90% done and > 1 minute remaining
			return item.percentage < 90 && (item.duration - item.time > 60);
		});
	}

	/**
	 * Finds an episode that is the most recently watched of a series and was also finished.
	 * @param list The list of watched items to check.
	 */
	public static async getLastFinishedEpisodes(cnt = 2): Promise<WatchProgress[]> {
		const recent = await WatchProgressService.getAllRecentlyWatched();
		const episodesOnly = WatchProgressService.filterOutExtraEpisodes(recent).filter((item) => WatchProgressService.isEpisode(item.relativePath));
		const lastFinished = episodesOnly.filter((item) => item.percentage >= 90);
		return lastFinished.slice(0, cnt);
	}
}
