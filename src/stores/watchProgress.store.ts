import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from './api.store';


export type Bookmark = WatchProgress & {
	id: string;
	name: string;
	titlePath: string,
	isAuto?: boolean;
}

export type WatchProgress = {
	time: number;
	duration: number;
	percentage: number;
	watchedAt: number;
	relativePath: string;
}

type BookmarkKeys = {
	id: string,
	titlePath: string,
	name: string,
}

export const useWatchProgressStore = defineStore('WatchProgress', () => {
	const lastWatchProgress = ref<{ relativePath: string, progress: WatchProgress } | null>(null);

	async function postProgress(relativePath: string, progress: any, bookmarkKeys?: BookmarkKeys, localKey?: string) {
		lastWatchProgress.value = {
			relativePath,
			progress,
		};

		await useApiStore().api.post('/watchProgress', {
			path: relativePath,
			progress,
			bookmarkKeys,
		});

		if (localKey) {
			updateLocalProgress(localKey, progress);
		}
	}

	async function deleteBookmark(relativePath: string, bookmarkId: string) {
		await useApiStore().api.delete('/watchProgress/bookmark', {
			data: {
				path: relativePath,
				bookmarkId,
			}
		});
	}

	async function removeProgress(relativePath: string) {
		await useApiStore().api.delete('/watchProgress', {
			data: {
				path: relativePath,
			}
		});
		deleteLocalProgress(relativePath);
	}


	function getLocalProgress(localKey: string) {
		const key = `localProgress_${localKey}`;
		const localProgress = localStorage.getItem(key);
		if (localProgress) {
			return JSON.parse(localProgress);
		}
		return null;
	}

	function updateLocalProgress(localKey: string, progress: any) {
		const key = `localProgress_${localKey}`;
		if (progress.percentage >= 99) {
			// Remove the progress from local storage if the video is finished
			localStorage.removeItem(key);
			return;
		}
		localStorage.setItem(key, JSON.stringify(progress));
	}

	function deleteLocalProgress(localKey: string) {
		const key = `localProgress_${localKey}`;
		localStorage.removeItem(key);
	}

	function createProgress(mediaFilePath: string, currentTime: number, duration: number): WatchProgress {
		return {
			relativePath: mediaFilePath,
			time: currentTime,
			duration: duration,
			percentage: parseInt((currentTime / duration * 100).toFixed(5)),
			watchedAt: Date.now(),
		};
	}

	return {
		lastWatchProgress,
		postProgress,
		removeProgress,
		deleteBookmark,
		createProgress,
		getLocalProgress,
	}
})
