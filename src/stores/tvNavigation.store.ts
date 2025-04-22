import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router';

export const useTvNavigationStore = defineStore('TvNavigation', () => {
	const lastMouseMoveEvent = ref('');
	const lastKeydownEvent = ref('');

	document.addEventListener('mousemove', (event) => {
		lastMouseMoveEvent.value = `Mouse moved to (${event.clientX}, ${event.clientY})`;
	});

	document.addEventListener('keydown', (event) => {
		switch (event.key) {
			case 'ArrowUp':
				lastKeydownEvent.value = 'Up arrow pressed';
				break;
			case 'ArrowDown':
				lastKeydownEvent.value = 'Down arrow pressed';
				break;
			case 'ArrowLeft':
				lastKeydownEvent.value = 'Left arrow pressed';
				break;
			case 'ArrowRight':
				lastKeydownEvent.value = 'Right arrow pressed';
				break;
			default:
				lastKeydownEvent.value = `Other key pressed: ${event.key}`;
		}
	});

	// const updateHandles = () => {
	// 	const elements = document.querySelectorAll('.tv-navigation');

	// const mutationObserver = new MutationObserver(updateHandles);
	// mutationObserver.observe(document.body, {
	// 	childList: true,
	// 	subtree: true,
	// });

	return {
		lastMouseMoveEvent,
		lastKeydownEvent,
	}
})
