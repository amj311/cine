import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from './api.store';

export const useAppNavigationStore = defineStore('AppNavigation', () => {
	const showNavbar = ref(true);
	const libraries = ref<Array<{ folderName: string, relativePath: string, libraryItem: any }>>([]);

	async function fetchLibraries() {
		const { data } = await useApiStore().api.get('/rootLibraries');
		libraries.value = data.data;
	}

	fetchLibraries().catch((err) => {
		console.error("Could not fetch libraries", err);
	})

	return {
		showNavbar,
		libraries,
	}
})
