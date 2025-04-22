<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import api from '@/services/api'
import { MetadataService } from '@/services/metadataService';
import { useRoute, useRouter } from 'vue-router';
import { useTvNavigationStore } from '@/stores/tvNavigation.store';
import { useBackgroundStore } from '@/stores/background.store';

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const mediaPath = computed(() => queryPathStore.currentPath || '')
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const theatreRef = ref<InstanceType<typeof HTMLElement>>();
const didAutoFullscreen = ref(false);
const hasLoaded = ref(false);

const showControlsTime = 2500;
const hideControlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const showControls = ref(true);
function updateShowControlsTimeout() {
	if (hideControlsTimeout.value) {
		clearTimeout(hideControlsTimeout.value);
	}
	showControls.value = true;
	hideControlsTimeout.value = setTimeout(() => {
		showControls.value = false;
	}, showControlsTime);
} 

const isLoadingLibrary = ref(false);
const parentLibrary = ref<any>(null);
const playable = ref<any>(null);

async function loadMediaData() {
	try {
		isLoadingLibrary.value = true;
		const { data } = await api.get('/theaterData', {
			params: {
				relativePath: mediaPath.value,
			}
		});
		parentLibrary.value = data.data.parentLibrary;
		playable.value = data.data.playable;

		await initialProgress();
	} catch (error) {
		console.error('Error loading media data', error);
	} finally {
		isLoadingLibrary.value = false;
	}
}

const route = useRoute();

async function initialProgress() {
	if (!mediaPath) {
		return;
	}
	const query = route?.query;
	if (query.startTime) {
		playerRef.value!.setTime(Number(query.startTime));
		// remove route start time
		history.replaceState(
			{},
			'',
			route.path + '?' + new URLSearchParams({ ...(route.query || {}), startTime: '' }).toString(),
		)
		return;
	}

	if (playable.value.watchProgress) {
		console.log("Setting time from watch progress", playable.value.watchProgress.time);
		playerRef.value?.setTime(playable.value.watchProgress.time);
		return;
	}

	try {
		const { data } = await api.get('/watchProgress', {
			params: {
				relativePath: mediaPath.value,
			}
		})
		if (data.data) {
			playerRef.value?.setTime(data.data.time)
		}
	}
	catch (e) {
		console.error(e)
	}
}

let wakeLock: WakeLockSentinel | null = null;

let wasTvMode = false;
function pauseTvMode() {
	if (useTvNavigationStore().enabled) {
		wasTvMode = true;
		useTvNavigationStore().disengageTvMode();
	}
}
function resumeTvMode() {
	if (wasTvMode) {
		wasTvMode = false;
		useTvNavigationStore().engageTvMode();
	}
}

async function attemptAutoFullscreen() {
	try {
		const router = useRouter();
		await document.documentElement.requestFullscreen();
		didAutoFullscreen.value = true;

		// If auto fullscreen was successful, we should leave this page when fullscreen exits
		document.addEventListener('fullscreenchange', onFullScreenChange, false);
		document.addEventListener('webkitfullscreenchange', onFullScreenChange, false);
		document.addEventListener('mozfullscreenchange', onFullScreenChange, false);

		function onFullScreenChange() {
			var fullscreenElement =
				document.fullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).webkitFullscreenElement;

				// This fires when the first element goes fullscreen
				// The Element will be null when exiting fullscreen
				if (!fullscreenElement) {
					document.removeEventListener('fullscreenchange', onFullScreenChange);
					document.removeEventListener('webkitfullscreenchange', onFullScreenChange);
					document.removeEventListener('mozfullscreenchange', onFullScreenChange);

					// make sure we're still on the play route before going back
					if (router.currentRoute.value.name !== 'play') {
						return;
					}
					router.back();
				}
		}
	} catch (e) {
	}
}


onMounted(async () => {
	loadMediaData();

	// Pause TV mode to allow interaction with VideoPlayer UI
	pauseTvMode();
	attemptAutoFullscreen();

	
	if ('wakeLock' in navigator) {
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch (e) {
			console.error("Failed to acquire wake lock", e);
		}
	}

	// Setup control hiding
	const events = ['mousemove', 'keydown', 'touchstart'];
	events.forEach((event) => {
		theatreRef.value?.addEventListener(event, updateShowControlsTimeout, { passive: true });
	});

})

onBeforeUnmount(async () => {
	// Resume TV mode
	resumeTvMode();
	
	if (didAutoFullscreen.value && !useTvNavigationStore().detectedTv) {
		try {
			document.exitFullscreen();
		} catch (e) {}
	}

	// release wake lock
	if (wakeLock) {
		await wakeLock.release();
		wakeLock = null;
	}
});

const PROGRESS_INTERVAL = 1000 * 30;
const progressUpdateInterval = setInterval(async () => {
	try {
		const progress = playerRef.value?.getProgress();
		if (!progress) {
			return;
		}
		await api.post('/watchProgress', {
			relativePath: mediaPath.value,
			progress,
		});
	}
	catch (e) {
		console.error("Failed to update progress")
		console.error(e);
	}
}, PROGRESS_INTERVAL);


onBeforeUnmount(() => {
	clearInterval(progressUpdateInterval);
})

function onloaded(data: any) {
	hasLoaded.value = true;
}

</script>

<template>
	<div ref="theatreRef" class="movie-theater" :class="{ 'show-controls': showControls }">
		<VideoPlayer v-show="hasLoaded" ref="playerRef" v-if="mediaPath" :src="mediaPath" :onLoadedData="onloaded" />
		<div class="loading" v-if="!hasLoaded">
			<i class="pi pi-spin pi-spinner" style="font-size: 3em; color: #fff;" />
		</div>
		<div class="top-left overlay">
			<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="$router.back()" />
			<div>{{ playable?.name }}</div>
		</div>
	</div>
</template>

<style
	lang="scss"
	scoped
>
	.movie-theater {
		height: 100%;
		position: relative;


		.loading {
			position: absolute;
			top: 50%;
			left: 50%;
		}

		.overlay {
			color: #fff !important;
			opacity: 0;
			transition: 500ms;
			zoom: 1.5;
		}
		&.show-controls {
			.overlay {
				opacity: 1;
			}
		}

		.top-left {
			position: absolute;
			top: 10px;
			left: 10px;
			z-index: 1000;
			display: flex;
			gap: .5em;
			align-items: center;
		}
	}
</style>
