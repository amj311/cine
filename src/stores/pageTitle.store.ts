import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const DEFAULT_TITLE = "OlivePlex Cinemas";

export const usePageTitleStore = defineStore('PageTitle', () => {
	const title = ref(DEFAULT_TITLE);

	function setTitle(newTitle: string) {
		title.value = newTitle || DEFAULT_TITLE;
		document.title = title.value;
	}

	setTitle(DEFAULT_TITLE);

	return {
		title,

		setTitle,
		clearPageTitleUrl() {
			this.setTitle(DEFAULT_TITLE);
		}
	}
})
