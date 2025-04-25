import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

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
		posterUrl.value = url;
	}

	return {
		backgroundUrl,
		setBackgroundUrl(url: string) {
			backgroundUrl.value = url || null;
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
