import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from './api.store';

export const useWatchProgressStore = defineStore('WatchProgress', () => {
	const lastWatchProgress = ref<any>(null);

	async function postprogress(relativePath: string, progress: any) {
		lastWatchProgress.value = {
			relativePath,
			progress,
		};

		await useApiStore().api.post('/watchProgress', {
			relativePath,
			progress,
		});
	}
	return {
		lastWatchProgress,
		postprogress,
	}
})
