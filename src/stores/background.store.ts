import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const DEFAULT_BG = "https://wallpapercave.com/wp/wp2633733.jpg";

export const useBackgroundStore = defineStore('Background', () => {
	const backgroundUrl = ref(DEFAULT_BG);

	return {
		backgroundUrl,
		setBackgroundUrl(url: string) {
			backgroundUrl.value = url || DEFAULT_BG;
		},
		clearBackgroundUrl() {
			backgroundUrl.value = DEFAULT_BG;
		}
	}
})
