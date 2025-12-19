/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { Store } from "./DataService";
import { ConfirmedPath, RelativePath } from "./DirectoryService";

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
type Bookmark = WatchProgress & {
	name: string,
}

type WatchProgressWithBookmarks = WatchProgress & {
	bookmarks: Bookmark[],
}

// const watching = new Map<RelativePath, WatchProgress>();
// const bookmarks = new Map<RelativePath, Map<string, Bookmark>>();

const watchingStore = new Store<WatchProgress>('watchProgress',)
const bookmarkStore = new Store<Record<string, Bookmark>>('bookmarks',)

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
		await watchingStore.set(path.relativePath, {
			...progress,
			relativePath: path.relativePath,
		});

		if (bookmarkId) {
			// Save the bookmark progress
			const bookmarksForMedia = await bookmarkStore.getByKey(path.relativePath) || {};
			bookmarksForMedia[bookmarkId] = {
				...progress,
				relativePath: path.relativePath,
				name: bookmarkId,
			};
			await bookmarkStore.set(path.relativePath, bookmarksForMedia);
		}
	}

	/**
	 * Returns the current watching progress of a media.
	 * @param path The id of the media.
	 * @returns The watching progress of the media.
	 */
	public static async getWatchProgress(path: ConfirmedPath): Promise<WatchProgressWithBookmarks | null> {
		const progress = await watchingStore.getByKey(path.relativePath);
		if (progress) {
			return {
				...progress,
				bookmarks: Array.from(Object.values((await bookmarkStore.getByKey(path.relativePath)) || {})),
			}
		}
		return null;
	}

	public static async deleteWatchProgress(path: ConfirmedPath): Promise<void> {
		await watchingStore.delete(path.relativePath);
		await bookmarkStore.delete(path.relativePath);
		console.log(await watchingStore.getByKey(path.relativePath))
	}

	public static async deleteBookmark(path: ConfirmedPath, bookmarkId: string) {
		const bookmarksForMedia = await bookmarkStore.getByKey(path.relativePath);
		if (bookmarksForMedia) {
			delete bookmarksForMedia[bookmarkId];
			await bookmarkStore.set(path.relativePath, bookmarksForMedia);
		}
	}

	public static async getAllRecentlyWatched(): Promise<WatchProgress[]> {
		return (await watchingStore.getAll()).sort((a, b) => {
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
			return item.percentage < 90;
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
