import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from './api.store';

// const DEFAULT_BG = "https://wallpaperaccess.com/full/4477509.jpg";
// const DEFAULT_BG = '/assets/bg.jpg';

export const useBackgroundStore = defineStore('Background', () => {
	const backgroundUrl = ref<null | string>(null);
	const posterUrl = ref<string | null>(null);

	function setPosterUrl(url: string) {
		if (!url) {
			posterUrl.value = null;
			return;
		}
		posterUrl.value = useApiStore().resolve(url) || null;
	}

	return {
		backgroundUrl,
		setBackgroundUrl(url: string) {
			backgroundUrl.value = useApiStore().resolve(url) || null;
		},
		clearBackgroundUrl() {
			backgroundUrl.value = null;
		},

		posterUrl,
		setPosterUrl,
		clearPosterUrl() {
			setPosterUrl('');
		}
	}
})
