import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const DEFAULT_BG = "https://wallpaperaccess.com/full/4477509.jpg";

export const useBackgroundStore = defineStore('Background', () => {
	const backgroundUrl = ref(DEFAULT_BG);
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
			backgroundUrl.value = url || DEFAULT_BG;
		},
		clearBackgroundUrl() {
			backgroundUrl.value = DEFAULT_BG;
		},

		posterUrl,
		setPosterUrl,
		clearPosterUrl() {
			setPosterUrl('');
		}
	}
})
