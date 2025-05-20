/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { RelativePath } from "./DirectoryService";

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

const watching = new Map<RelativePath, WatchProgress>();
const bookmarks = new Map<RelativePath, Map<string, Bookmark>>();

export class WatchProgressService {
	/**
	 * Sets the current watching progress of a media.
	 * If the media is nearly done, it is considered finished.
	 * If the media is finished, it is removed from the list.
	 * @param relativePath The id of the media.
	 * @param percentage The percentage of the media that has been watched.
	 */
	public static updateWatchProgress(relativePath: RelativePath, progress: WatchProgress, bookmarkId?: string): void {
		// Always save the overall progress
		watching.set(relativePath, {
			...progress,
			relativePath,
		});

		if (bookmarkId) {
			// Save the bookmark progress
			const bookmarksForMedia = bookmarks.get(relativePath) || new Map<string, Bookmark>();
			bookmarksForMedia.set(bookmarkId, {
				...progress,
				relativePath,
				name: bookmarkId,
			});
			bookmarks.set(relativePath, bookmarksForMedia);
		}
	}

	/**
	 * Returns the current watching progress of a media.
	 * @param relativePath The id of the media.
	 * @returns The watching progress of the media.
	 */
	public static getWatchProgress(relativePath: RelativePath): WatchProgressWithBookmarks | null {
		const progress = watching.get(relativePath);
		if (progress) {
			return {
				...progress,
				bookmarks: Array.from(bookmarks.get(relativePath)?.values() || []),
			}
		}
		return null;
	}

	public static deleteBookmark(relativePath: RelativePath, bookmarkId: string): void {
		const bookmarksForMedia = bookmarks.get(relativePath);
		if (bookmarksForMedia) {
			bookmarksForMedia.delete(bookmarkId);
		}
	}

	public static getAllRecentlyWatched(): WatchProgress[] {
		return Array.from(watching.values()).sort((a, b) => {
			return b.watchedAt - a.watchedAt;
		}).slice(0, 50);
	}

	private static isEpisode(relativePath: RelativePath): boolean {
		return relativePath.toLowerCase().includes("/season ");
	}

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
	public static getContinueWatchingList() {
		const recent = WatchProgressService.getAllRecentlyWatched();
		return WatchProgressService.filterOutExtraEpisodes(recent).filter((item) => {
			return item.percentage < 90;
		});
	}

	/**
	 * Finds an episode that is the most recently watched of a series and was also finished.
	 * @param list The list of watched items to check.
	 */
	public static getLastFinishedEpisode(): WatchProgress | null {
		const recent = WatchProgressService.getAllRecentlyWatched();
		const episodesOnly = WatchProgressService.filterOutExtraEpisodes(recent).filter((item) => WatchProgressService.isEpisode(item.relativePath));
		if (episodesOnly.length === 0) {
			return null;
		}
		const lastFinished = episodesOnly.filter((item) => item.percentage >= 90);
		return lastFinished[0] || null;
	}
}
