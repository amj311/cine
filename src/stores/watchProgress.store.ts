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

	async function postprogress(relativePath: string, progress: any, bookmarkId?: string) {
		lastWatchProgress.value = {
			relativePath,
			progress,
		};

		await useApiStore().api.post('/watchProgress', {
			relativePath,
			progress,
			watcherId: getWatcherId(),
			bookmarkId,
		});
	}

	async function deleteBookmark(relativePath: string, bookmarkId: string) {
		await useApiStore().api.delete('/watchProgress/bookmark', {
			data: {
				relativePath,
				bookmarkId,
			}
		});
	}

	function getWatcherId() {
		const key = 'watcherId';
		const watcherId = localStorage.getItem(key);
		if (watcherId) {
			return watcherId;
		}
		const newWatcherId = Math.random().toString(36).substring(2, 15);
		localStorage.setItem(key, newWatcherId);
		return newWatcherId;
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
		postprogress,
		deleteBookmark,
		createProgress,
	}
})
