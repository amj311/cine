<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import api from '@/services/api'
import { MetadataService } from '@/services/metadataService';
import { useRoute, useRouter } from 'vue-router';
import { useTvNavigationStore } from '@/stores/tvNavigation.store';
import { useBackgroundStore } from '@/stores/background.store';
import { usePageTitleStore } from '@/stores/pageTitle.store';
import { useFullscreenStore } from '@/stores/fullscreenStore.store';

const router = useRouter();

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const mediaPath = computed(() => queryPathStore.currentPath || '')
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const theaterRef = ref<InstanceType<typeof HTMLElement>>();
const didAutoFullscreen = ref(false);
const hasLoaded = ref(false);

const showControlsTime = 2500;
const hideControlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const showControls = ref(false);
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

		if (!parentLibrary.value.metadata) {
			parentLibrary.value.metadata = await MetadataService.getMetadata(parentLibrary.value, true);
		}

		if (parentLibrary.value.metadata?.background) {
			useBackgroundStore().setBackgroundUrl(parentLibrary.value.metadata.background);
		}

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

function carefulBackNav() {
	// TODO: Use router to go back if there is history. Otherwise go to the parent library
	// if (window.history.state && window.history.state.back) {
	// 	router.back();
	// } else {
	// 	router.push({
	// 		name: 'library',
	// 		params: {
	// 			libraryId: parentLibrary.value.id,
	// 		}
	// 	});
	// }
	router.back();
}

function navigateBackOnFullscreenExit() {
	// If we are still in the movie theater but fullscreen has exited, we should navigate backward
	// make sure we're still on the play route before going back
	if (router.currentRoute.value.name !== 'play') {
		return;
	}
	carefulBackNav();
}

async function attemptAutoFullscreen() {
	try {
		if (useFullscreenStore().isAppInFullscreenMode) {
			console.log("Already in fullscreen mode");
			return;
		}

		useFullscreenStore().tempFullscreen('movie-theater');
		didAutoFullscreen.value = true;
	} catch (e) {
	}
}


onMounted(async () => {
	updateShowControlsTimeout();
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
		theaterRef.value?.addEventListener(event, updateShowControlsTimeout, { passive: true });
	});

	// Setup fullscreen exit handling
	useFullscreenStore().addFullscreenChangeListener((isFullscreen) => {
		if (!isFullscreen) {
			navigateBackOnFullscreenExit();
		}
	});

})

onBeforeUnmount(async () => {
	// Resume TV mode
	resumeTvMode();
	
	if (didAutoFullscreen.value) {
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

const episodeMetadata = computed(() => {
	if (playable.value?.type !== 'episode') {
		return null;
	}
	return parentLibrary.value.metadata?.seasons
		.find((season: any) => season.seasonNumber === playable.value.seasonNumber)?.episodes
		.find((episode: any) => episode.episodeNumber === playable.value.episodeNumber);
});

const title = computed(() => {
	if (!playable.value) {
		return '';
	}
	if (playable.value?.type === 'extra') {
		return playable.value.name + " - " + parentLibrary.value.folderName;
	}
	if (playable.value?.type === 'movie') {
		return playable.value.name;
	}
	if (playable.value?.type === 'episode') {
		return `${parentLibrary.value.name} S${playable.value.seasonNumber}:E${playable.value.episodeNumber}` + (episodeMetadata.value?.name ? ` "${episodeMetadata.value.name}"` : '');
	}
	return playable.value.name;
});
watch(title, (newTitle) => {
	usePageTitleStore().setTitle(newTitle);
});

</script>

<template>
	<div ref="theaterRef" class="movie-theater" :class="{ 'show-controls': showControls }">
		<VideoPlayer v-show="hasLoaded" ref="playerRef" v-if="mediaPath" :src="mediaPath" :onLoadedData="onloaded" />
		<div class="loading" v-if="!hasLoaded">
			<i class="pi pi-spin pi-spinner" style="font-size: 3em; color: #fff;" />
		</div>
		<div class="top-left overlay">
			<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="carefulBackNav" />
			<div>{{ title }}</div>
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
