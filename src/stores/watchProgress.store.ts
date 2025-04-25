import { ref } from 'vue'
import { defineStore } from 'pinia'
import api from '@/services/api';

export const useWatchProgressStore = defineStore('WatchProgress', () => {
	const lastWatchProgress = ref<any>(null);

	async function postprogress(relativePath: string, progress: any) {
		lastWatchProgress.value = {
			relativePath,
			progress,
		};

		await api.post('/watchProgress', {
			relativePath,
			progress,
		});
	}
	return {
		lastWatchProgress,
		postprogress,
	}
})
