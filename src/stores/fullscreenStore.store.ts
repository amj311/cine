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
		try {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if ((document as any).mozCancelFullScreen) { // Firefox
				(document as any).mozCancelFullScreen();
			} else if ((document as any).webkitExitFullscreen) { // Chrome, Safari and Opera
				(document as any).webkitExitFullscreen();
			} else if ((document as any).msExitFullscreen) { // IE/Edge
				(document as any).msExitFullscreen();
			}
		}
		catch (err) {
			console.error('Error exiting fullscreen:', err);
		}
	}

	// If auto fullscreen was successful, we should leave this page when fullscreen exits
	document.addEventListener('fullscreenchange', onFullScreenChange);
	document.addEventListener('webkitfullscreenchange', onFullScreenChange);
	document.addEventListener('mozfullscreenchange', onFullScreenChange);

	function onFullScreenChange(e) {
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
		let shouldDoListeners = true;
		if (!newValue && userWantsFullscreen.value) {
			// If the user wants fullscreen but we are not in fullscreen mode, go fullscreen
			console.log('User wants fullscreen, but we are not in fullscreen mode - calling handler');
			if (accidentalExitHandler) {
				const returnToFullscreen = await accidentalExitHandler();
				if (returnToFullscreen) {
					console.log('Accidental exit handler returned true - going fullscreen. Skipping listeners.');
					userWantsFullscreen.value = true;
					shouldDoListeners = false;
					console.log(shouldDoListeners)
					goFullscreen();
				}
				else {
					userWantsFullscreen.value = false;
					console.log('User chose to leave fullscreen.')
				}
			}
		}
		if (shouldDoListeners) {
			fullscreenChangeListeners.forEach((listener) => {
				listener(newValue);
			});
		}
	});


	function userFullscreenRequest() {
		userWantsFullscreen.value = true;
		goFullscreen();
	}
	function userExitFullscreen() {
		userWantsFullscreen.value = false;
		exitFullscreen();
	}

	return {
		isAppInFullscreenMode,
		userWantsFullscreen,

		addFullscreenChangeListener,
		removeFullscreenChangeListener,

		setAccidentalExitHandler(handler: () => Promise<boolean>) {
			accidentalExitHandler = handler;
		},
		userToggle() {
			if (!isAppInFullscreenMode.value) {
				userFullscreenRequest();
			}
			else {
				userExitFullscreen();
			}
		},
		userFullscreenRequest,
		userExitFullscreen,
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
