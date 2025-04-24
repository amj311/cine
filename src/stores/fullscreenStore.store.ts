import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useFullscreenStore = defineStore('Fullscreen', () => {
	const canRequestFullscreen = ref(true);
	const userWantsFullscreen = ref(false);
	const tempFullscreenReason = ref('');
	const isAppInFullscreenMode = ref(false);

	function goFullscreen() {
		if (!userWantsFullscreen.value) {
			if (tempFullscreenReason.value) {
				console.log('Fullscreen because of reason:', tempFullscreenReason.value);
			}
			else {
				console.warn('Fullscreen not requested by user, and no reason given - aborting');
				return;
			}
		}
		if (isAppInFullscreenMode.value) {
			return;
		}
		const docEl = document.documentElement as any;
		try {
			if (docEl.requestFullscreen) {
				docEl.requestFullscreen();
			} else if (docEl.mozRequestFullScreen) { // Firefox
				docEl.mozRequestFullScreen();
			} else if (docEl.webkitRequestFullscreen) { // Chrome, Safari and Opera
				docEl.webkitRequestFullscreen();
			} else if (docEl.msRequestFullscreen) { // IE/Edge
				docEl.msRequestFullscreen();
			}
		}
		catch (err) {
			console.error('Error requesting fullscreen:', err);
			console.log('Assuming fullscreen is not supported.');
			canRequestFullscreen.value = false;
		}
	}

	function exitFullscreen() {
		if (!isAppInFullscreenMode.value) {
			return;
		}
		const docEl = document.documentElement as any;
		try {
			if (docEl.exitFullscreen) {
				docEl.exitFullscreen();
			} else if (docEl.mozExitFullScreen) { // Firefox
				docEl.mozExitFullscreen();
			} else if (docEl.webkitExitFullscreen) { // Chrome, Safari and Opera
				docEl.webkitExitFullscreen();
			} else if (docEl.msExitFullscreen) { // IE/Edge
				docEl.msExitFullscreen();
			}
		}
		catch (err) {
			console.error('Error exiting fullscreen:', err);
		}
	}

	// If auto fullscreen was successful, we should leave this page when fullscreen exits
	document.addEventListener('fullscreenchange', onFullScreenChange, false);
	document.addEventListener('webkitfullscreenchange', onFullScreenChange, false);
	document.addEventListener('mozfullscreenchange', onFullScreenChange, false);

	function onFullScreenChange() {
		var fullscreenElement =
			document.fullscreenElement ||
			(document as any).mozFullScreenElement ||
			(document as any).webkitFullscreenElement
			;
		isAppInFullscreenMode.value = Boolean(fullscreenElement);
	}


	const fullscreenChangeListeners: Map<string, (isFullscreen: boolean) => void> = new Map();
	const addFullscreenChangeListener = (listener: (isFullscreen: boolean) => void) => {
		const functionString = listener.toString();
		fullscreenChangeListeners.set(functionString, listener);
	}
	const removeFullscreenChangeListener = (listener: (isFullscreen: boolean) => void) => {
		const functionString = listener.toString();
		fullscreenChangeListeners.delete(functionString);
	}


	let accidentalExitHandler = async () => await Promise.resolve(false);
	watch(isAppInFullscreenMode, async (newValue) => {
		if (!newValue && userWantsFullscreen.value) {
			// If the user wants fullscreen but we are not in fullscreen mode, go fullscreen
			console.log('User wants fullscreen, but we are not in fullscreen mode - calling handler');
			if (accidentalExitHandler) {
				const returnToFullscreen = await accidentalExitHandler();
				if (returnToFullscreen) {
					console.log('Accidental exit handler returned true - going fullscreen. Skipping listeners.');
					userWantsFullscreen.value = true;
					goFullscreen();
				}
				else {
					userWantsFullscreen.value = false;
					console.log('User chose to leave fullscreen. Trigerring listeners.')
					for (const listener of fullscreenChangeListeners.values()) {
						listener(newValue);
					}
				}
			}
		}
	});

	return {
		isAppInFullscreenMode,
		userWantsFullscreen,

		addFullscreenChangeListener,
		removeFullscreenChangeListener,

		setAccidentalExitHandler(handler: () => Promise<boolean>) {
			accidentalExitHandler = handler;
		},
		userFullscreenRequest() {
			userWantsFullscreen.value = true;
			goFullscreen();
		},
		userExitFullscreen() {
			userWantsFullscreen.value = false;
			exitFullscreen();
		},
		tempFullscreen(reason: string) {
			tempFullscreenReason.value = reason;
			goFullscreen();
		},
		exitTempFullscreen() {
			tempFullscreenReason.value = '';
			exitFullscreen();
		},
	}
})
