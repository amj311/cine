/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { RelativePath } from "./DirectoryService";

export type WatchProgress = {
	time: number,
	duration: number,
	percentage: number,
	watchedAt: Date,
}
const watching = new Map<RelativePath, WatchProgress>();

export class WatchProgressService {
	/**
	 * Sets the current watching progress of a media.
	 * If the media is nearly done, it is considered finished.
	 * If the media is finished, it is removed from the list.
	 * @param relativePath The id of the media.
	 * @param percentage The percentage of the media that has been watched.
	 */
	public static updateWatchProgress(relativePath: RelativePath, progress: WatchProgress): void {
		// if (progress.percentage >= 90) {
		// 	watching.delete(relativePath);
		// 	return;
		// }
		watching.set(relativePath, progress);
	}

	/**
	 * Returns the current watching progress of a media.
	 * @param relativePath The id of the media.
	 * @returns The watching progress of the media.
	 */
	public static getWatchProgress(relativePath: RelativePath): WatchProgress | null {
		return watching.get(relativePath) || null;
	}
}
