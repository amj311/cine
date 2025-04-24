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

const mediaPath = ref(queryPathStore.currentPath || '')
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const theaterRef = ref<InstanceType<typeof HTMLElement>>();
const didAutoFullscreen = ref(false);
const hasLoaded = ref(false);
const hasEnded = ref(false);
const playerProgress = ref<any>(null); // WatchProgress type

const nextEpisodeFile = computed(() => {
	if (playable.value?.type !== 'episodeFile') {
		return null;
	}
	const allEpisdoes = parentLibrary.value?.seasons
		.flatMap((season: any) => season.episodeFiles);
	const currentIndex = allEpisdoes?.findIndex((episode: any) => episode.name === playable.value.name);
	if (currentIndex === undefined || currentIndex === -1) {
		return null;
	}
	const nextIndex = currentIndex + 1;
	if (nextIndex >= allEpisdoes?.length) {
		return null;
	}
	return allEpisdoes?.[nextIndex];
});

const showNextEpisodeCard = computed(() => {
	return Boolean(nextEpisodeFile.value && (playerProgress.value?.duration - playerProgress.value?.time < 30));
});

const showPlayer = computed(() => {
	return Boolean(mediaPath.value && hasLoaded.value && !hasEnded.value);
});

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

async function loadMediaData(pathToLoad: string) {
	try {
		isLoadingLibrary.value = true;
		const { data } = await api.get('/theaterData', {
			params: {
				relativePath: pathToLoad,
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
	if (router.options?.history?.state?.back) {
		router.back();
	} else {
		router.push({
			name: 'browse',
			query: {
				path: parentLibrary.value?.relativePath || '',
			}
		});
	}
}

function navigateBackOnFullscreenExit(isFullscreen: boolean) {
	if (isFullscreen) {
		return;
	}
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


async function playMedia(pathToLoad: string, restart = false) {
	if (!mediaPath) {
		return;
	}
	history.replaceState(
		{},
		'',
		router.currentRoute.value.path + '?' + new URLSearchParams({ ...(router.currentRoute.value.query || {}), path: pathToLoad }).toString(),
	);
	mediaPath.value = pathToLoad;
	playerRef.value?.setTime(0);
	playerProgress.value = playerRef.value?.getProgress();
	await loadMediaData(pathToLoad);
	if (!restart) {
		await initialProgress();
	}
}

onMounted(async () => {
	playMedia(mediaPath.value).catch((e) => {
		console.error("Failed to load media data", e);
	});
	updateShowControlsTimeout();
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
	useFullscreenStore().addFullscreenChangeListener(navigateBackOnFullscreenExit);

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

	useFullscreenStore().removeFullscreenChangeListener(navigateBackOnFullscreenExit);
});

const PROGRESS_INTERVAL = 1000 * 5;
const progressUpdateInterval = setInterval(async () => {
	const lastProgressTime = playerProgress.value?.time;
	playerProgress.value = playerRef.value?.getProgress();
	if (!playerProgress.value) {
		return;
	}
	if (lastProgressTime === playerProgress.value?.time) {
		return;
	}

	// Only post to server for certain intervals
	const POST_INTERVAL = 30; // Progress time is in seconds
	if (Math.abs(playerProgress.value?.time - lastProgressTime) > POST_INTERVAL) {
		try {
			if (!playerProgress.value) {
				return;
			}
			await api.post('/watchProgress', {
				relativePath: mediaPath.value,
				progress: playerProgress.value,
			});
		}
		catch (e) {
			console.error("Failed to update progress")
			console.error(e);
		}
	}
}, PROGRESS_INTERVAL);


onBeforeUnmount(() => {
	clearInterval(progressUpdateInterval);
})

const currentEpisodeMetadata = computed(() => {
	if (playable.value?.type !== 'episodeFile') {
		return null;
	}
	console.log(playable.value?.firstEpisodeNumber,
		parentLibrary.value?.metadata?.seasons.find((season: any) => season.seasonNumber === playable.value.seasonNumber)?.episodes
			.find((episode: any) => episode.episodeNumber === playable.value?.firstEpisodeNumber)
	);
	return parentLibrary.value?.metadata?.seasons
		.find((season: any) => season.seasonNumber === playable.value.seasonNumber)?.episodes
		.find((episode: any) => episode.episodeNumber === playable.value?.firstEpisodeNumber);
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
	if (playable.value?.type === 'episodeFile') {
		const metadataName = currentEpisodeMetadata.value?.name;
		const nameIsNotEpisodeNubmer = metadataName && !metadataName.toLowerCase().match(/episode \d{1,3}/);
		return `${parentLibrary.value?.name}: ${playable.value?.name}` + (nameIsNotEpisodeNubmer ? ` "${metadataName}"` : '');
	}
	return playable.value.name;
});
watch(title, (newTitle) => {
	usePageTitleStore().setTitle(newTitle);
});

const loadingBackground = computed(() => {
	if (hasLoaded.value) {
		return '';
	}
	return currentEpisodeMetadata.value?.still_full || parentLibrary.value?.metadata?.background;
});

</script>

<template>
	<div ref="theaterRef" class="movie-theater" :class="{ 'show-controls': showControls }" :style="{ backgroundImage: `url(${loadingBackground})` }">
		<VideoPlayer
			v-if="mediaPath"
			v-show="showPlayer"
			ref="playerRef"
			:src="mediaPath"
			:onLoadedData="() => hasLoaded = true"
			:onEnd="() => hasEnded = true"
		/>
		<div class="loading" v-if="!hasLoaded">
			<i class="pi pi-spin pi-spinner" style="font-size: 3em; color: #fff;" />
		</div>
		<div class="overlay top-fade"></div>
		<div class="top-left overlay">
			<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="carefulBackNav" />
			<div>{{ title }}</div>
		</div>
		<div v-if="showNextEpisodeCard" class="next-episode-card" :class="{ full: hasEnded }" @click="() => playMedia(nextEpisodeFile?.relativePath, true)">
			<div class="play-icon">
				<i class="pi pi-play" />
			</div>
			<div>
				<div>Play Next</div>
				<div style="opacity: .7">{{ nextEpisodeFile?.name }}</div>
			</div>
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
	background-image: none;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	transition: background-image 500ms;
	

	.loading {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.2));
	}

	.overlay {
		color: #fff !important;
		opacity: 0;
		transition: 500ms;
		zoom: 1.3;
	}
	&.show-controls {
		.overlay {
			opacity: 1;
		}
	}
	
	.top-fade {
		background: linear-gradient(to bottom, rgba(0, 0, 0, .5), rgba(0, 0, 0, 0));
		height: 4rem;
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
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

	.next-episode-card {
		position: absolute;
		bottom: 6rem;
		right: 1rem;
		border-radius: .5rem;
		padding: .6rem;
		background-color: var(--color-background-mute);
		cursor: pointer;
		user-select: none;
		display: flex;
		gap: .5em;

		&:hover, &:focus {
			box-shadow: 0 0 10px rgba(0, 0, 0, .3);
		}

		.play-icon {
			width: 2.5rem;
			height: 2.5rem;
			color: var(--color-contrast);
			display: flex;
			justify-content: center;
			align-items: center;
			background-color: var(--color-background);
		}
	}
}
</style>
