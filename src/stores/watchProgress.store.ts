import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from './api.store';

type SubWatchProgress = {
	relativePath: string;
	time: number;
	duration: number;
}

export type WatchProgress = {
	time: number;
	duration: number;
	percentage: number;
	watchedAt: number;
	relativePath?: string;
	sub?: SubWatchProgress;
}

export const useWatchProgressStore = defineStore('WatchProgress', () => {
	const lastWatchProgress = ref<any>(null);

	async function postProgress(relativePath: string, progress: any, bookmarkId?: string, local: boolean = false) {
		lastWatchProgress.value = {
			relativePath,
			progress,
		};

		await useApiStore().api.post('/watchProgress', {
			relativePath,
			progress,
			bookmarkId,
		});

		if (local) {
			updateLocalProgress(relativePath, progress);
		}
	}

	async function deleteBookmark(relativePath: string, bookmarkId: string) {
		await useApiStore().api.delete('/watchProgress/bookmark', {
			data: {
				relativePath,
				bookmarkId,
			}
		});
	}

	async function removeProgress(relativePath: string) {
		await useApiStore().api.delete('/watchProgress', {
			data: {
				relativePath,
			}
		});
		deleteLocalProgress(relativePath);
	}


	function getLocalProgress(relativePath: string) {
		const key = `localProgress_${relativePath}`;
		const localProgress = localStorage.getItem(key);
		if (localProgress) {
			return JSON.parse(localProgress);
		}
		return null;
	}

	function updateLocalProgress(relativePath: string, progress: any) {
		const key = `localProgress_${relativePath}`;
		if (progress.percentage >= 99) {
			// Remove the progress from local storage if the video is finished
			localStorage.removeItem(key);
			return;
		}
		localStorage.setItem(key, JSON.stringify(progress));
	}

	function deleteLocalProgress(relativePath: string) {
		const key = `localProgress_${relativePath}`;
		localStorage.removeItem(key);
	}

	function createProgress(currentTime: number, duration: number, sub?: SubWatchProgress) {
		return {
			time: currentTime,
			duration: duration,
			percentage: parseInt((currentTime / duration * 100).toFixed(5)),
			watchedAt: Date.now(),
			sub,
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
