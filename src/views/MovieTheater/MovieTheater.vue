<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useRoute, useRouter } from 'vue-router';
import { focusAreaClass, noFocusClass, useScreenStore } from '@/stores/screen.store';
import { useBackgroundStore } from '@/stores/background.store';
import { usePageTitleStore } from '@/stores/pageTitle.store';
import { useFullscreenStore } from '@/stores/fullscreenStore.store';
import MediaCard from '@/components/MediaCard.vue';
import { useWatchProgressStore, type WatchProgress } from '@/stores/watchProgress.store';
import { useToast } from 'primevue/usetoast';
import { useApiStore } from '@/stores/api.store';
import { useScrubberStore } from './scrubber.store';
import ScrubSettings from './ScrubSettings.vue';
import DropdownTrigger from '@/components/utils/DropdownTrigger.vue';
import { encodeMediaPath, formatRuntime_m, pluralize } from '@/utils/miscUtils';
import type NavTrigger from '@/components/utils/NavTrigger/NavTrigger.vue';
import ToggleSwitch from '@/components/utils/ToggleSwitch.vue';
import PersonModal from '@/components/PersonModal.vue';
import Scroll from '@/components/Scroll.vue';
import ExtrasList from '@/components/ExtrasList.vue';
import { useMediaStore } from '@/stores/media.store';

const toast = useToast();
const router = useRouter();
const api = useApiStore().api;

const queryPath = computed(() => useMediaStore().currentPath as string);
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const didAutoFullscreen = ref(false);
const hasLoaded = ref(false);
const hasEnded = ref(false);
const showEndScreen = ref(false);
const userLeftEndScreen = ref(false);
const endScreenHasContent = computed(() => Boolean(nextEpisode.value || parentExtrasToShow.value || seasonExtrasToShow.value));
const playerProgress = ref<WatchProgress | null>(null); // WatchProgress type

const isLoadingLibrary = ref(false);
const parentTitle = ref<any>(null);
const contentFile = ref<any>(null);
const probe = ref<any>(null);

const playablePath = computed(() => contentFile.value?.relativePath);

const showPlayer = computed(() => {
	return Boolean(queryPath.value && !hasEnded.value);
});

function resetState() {
	playerRef.value?.videoRef?.pause();
	playerRef.value?.setTime(0);
	playerProgress.value = null;
	parentTitle.value = null;
	contentFile.value = null;
	hasEnded.value = false;
	hasLoaded.value = false;
	userLeftEndScreen.value = false;
	leaveEndScreen(false);
}

async function loadMediaData(pathToLoad: string) {
	try {
		isLoadingLibrary.value = true;
		const { data } = await api.get('/theaterData', {
			params: {
				path: pathToLoad,
			}
		});
		parentTitle.value = data.data.parentTitle;
		contentFile.value = data.data.content;
		probe.value = data.data.probe;

		parentTitle.value.metadata = await MetadataService.getMetadata(parentTitle.value, true);
	} catch (error) {
		console.error('Error loading media data', error);
	} finally {
		isLoadingLibrary.value = false;
	}
}

const route = useRoute();
let wakeLock: WakeLockSentinel | null = null;

function carefulBackNav() {
	if (router.options?.history?.state?.back) {
		router.back();
	} else {
		router.push({
			name: 'browse',
			query: {
				path: parentTitle.value?.relativePath || '',
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
	if (useScreenStore().detectedTv) {
		carefulBackNav();
	}
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

async function playMedia(pathToLoad: string, restart = true) {
	useMediaStore().playMedia(pathToLoad, { restart });
}


watch(() => useMediaStore().updated, async () => {
	if (!queryPath.value) {
		return;
	}
	const pathToLoad = queryPath.value;
	
	// RESET ALL THE THINGS
	resetState();

	await loadMediaData(pathToLoad);

	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: videoTitle.value,
			album: parentTitle.value?.name,
			artist: parentTitle.value?.name,
			artwork: [
				{ src: useApiStore().resolve(loadSplashUrl.value), sizes: '512x512', type: 'image/png' },
				{ src: useApiStore().resolve(loadSplashUrl.value), sizes: '256x256', type: 'image/png' },
				{ src: useApiStore().resolve(loadSplashUrl.value), sizes: '96x96', type: 'image/png' }
			],
		});
	}

	requestWakeLock();

	nextTick(async () => {
		if (playerRef.value?.videoRef) {
			await useScrubberStore().initForMedia(pathToLoad, playerRef.value.videoRef);
			await initialProgress();
			await initialAudio();
			playerRef.value?.videoRef.play();
		}
	})
}, {
	immediate: true,
})

onMounted(async () => {
	// consider this a new watching session and reset the timer
	await api.put('/timer/reset');

	// playMedia(mediaPath.value).catch((e) => {
	// 	console.error("Failed to load media data", e);
	// });

	requestWakeLock();

	// Setup fullscreen exit handling
	// pauseTvMode();
	attemptAutoFullscreen();
	useFullscreenStore().addFullscreenChangeListener(navigateBackOnFullscreenExit);

	// Attempt rotate screen
	// if ((screen.orientation as any)?.lock) {
	// 	try {
	// 		await (screen.orientation as any).lock('landscape');
	// 	} catch (e) {}
	// }

	// to update scrubs when using arrow keys or taps to seek
	const seekEvents = ['keyup', 'touch', 'click'];
	for (const event of seekEvents) {
		playerRef.value?.$el.addEventListener(event, () => {
			useScrubberStore().scheduleScrub();
		})
	}
})

onBeforeUnmount(async () => {
	clearInterval(progressUpdateInterval);

	// Resume TV mode
	// resumeTvMode();
	
	if (didAutoFullscreen.value) {
		try {
			document.exitFullscreen();
		} catch (e) {}
	}

	releaseWakeLock();

	useFullscreenStore().removeFullscreenChangeListener(navigateBackOnFullscreenExit);
	// unlock screen orientation
	if ((screen.orientation as any)?.unlock) {
		try {
			await (screen.orientation as any).unlock();
		} catch (e) {}
	}
});

async function initialProgress() {
	if (!queryPath.value) {
		return;
	}
	const urlParams = new URL(location.href).searchParams;
	const queryTime = urlParams.get('startTime');
	if (queryTime) {
		playerRef.value?.setTime(Number(queryTime));
		urlParams.delete('startTime');
		// remove route start time
		history.replaceState(
			{},
			'',
			route.path + '?' + urlParams.toString(),
		)
		return;
	}

	let watchProgress = contentFile.value.watchProgress;
	if (!watchProgress) {
		try {
			const { data } = await api.get('/watchProgress', {
				params: {
					path: queryPath.value,
				}
			})
			if (data.data) {
				watchProgress = data.data;
			}
		}
		catch (e) {
			console.error("error loading watchProgress", e)
		}
	}

	if (watchProgress && watchProgress.time < watchProgress.duration) {
		playerRef.value?.setTime(watchProgress.time);
		return;
	}
}

async function initialAudio() {
	if (!queryPath.value) {
		return;
	}
	const urlParams = new URL(location.href).searchParams;
	const audioTrack = urlParams.get('audioTrack');
	if (audioTrack) {
		playerRef.value?.setAudio(Number(audioTrack));
		urlParams.delete('audioTrack');
		// remove route start time
		history.replaceState(
			{},
			'',
			route.path + '?' + urlParams.toString(),
		)
	}
}

async function requestWakeLock() {
	if ('wakeLock' in navigator) {
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch (e) {
			console.error("Failed to acquire wake lock", e);
		}
	}
}

async function releaseWakeLock() {
	if (wakeLock) {
		await wakeLock.release();
		wakeLock = null;
	}
}

function onPlay() {
	requestWakeLock();
	hasEnded.value = false;
}

async function onEnd() {
	hasEnded.value = true;

	// update progress to finished
	const finishedTime = playerRef.value?.videoRef?.duration || 1; // just to satisfy TS and avoid division by 0
	await useWatchProgressStore().postProgress(
		queryPath.value,
		useWatchProgressStore().createProgress(contentFile.value.relativePath, finishedTime, finishedTime),
	);

	releaseWakeLock();

	if (willAutoplay.value) {
		return playNext();
	}
	else if (endScreenHasContent.value) {
		goToEndScreen();
	}
	else {
		carefulBackNav();
	}
}

const PROGRESS_INTERVAL = 1000;
let lastPostTime = 0;
const progressUpdateInterval = setInterval(async () => {
	const lastProgressTime = playerProgress.value?.time;
	playerProgress.value = playerRef.value?.getProgress() || null;
	if (!playerProgress.value) {
		return;
	}
	
	if (lastProgressTime === playerProgress.value?.time) {
		return;
	}
	
	// Only post to server for certain intervals
	const POST_INTERVAL = 30; // Progress time is in seconds
	if (!lastPostTime || Math.abs(playerProgress.value?.time - lastPostTime) > POST_INTERVAL) {
		try {
			if (!playerProgress.value) {
				return;
			}
			await useWatchProgressStore().postProgress(
				queryPath.value,
				playerProgress.value,
			);
			lastPostTime = playerProgress.value?.time;
		}
		catch (e) {
			console.error("Failed to update progress")
			console.error(e);
		}
	}
}, PROGRESS_INTERVAL);

watch(() => playerProgress.value?.time, (old, newTime) => {
	if (!playerProgress.value || !contentFile.value) {
		return;
	}

	// don't interfere with onEnd stuff
	if (playerProgress.value.percentage > 99) {
		return;
	}
	const endCardPercentages = {
		'movie': 95,
		'episodeFile': 97,
	}
	const endScreenPercentages = {
		'movie': 100,
		'episodeFile': 98.5,
	}
	const noEndScreenThreshold_s = 15; // if there's not much time left I'd prefer to just stick around to the end

	if (Boolean((playerProgress.value.percentage >= endCardPercentages[contentFile.value.type]))) {
		showEndingCards.value = true;
	}
	else {
		showEndingCards.value = false;
	}

	const timeLeft = playerProgress.value.duration - playerProgress.value.time;
	if (
		!userLeftEndScreen.value
		&& timeLeft > noEndScreenThreshold_s
		&& Boolean((playerProgress.value.percentage >= endScreenPercentages[contentFile.value.type]))
	) {
		goToEndScreen();
	}
});

/***************
 * METADATA
 */

const nextEpisode = computed(() => findNextEpisodeFile(1)?.episodes[0]);
const prevEpisode = computed(() => findNextEpisodeFile(-1)?.episodes[0]);

function findNextEpisodeFile(delta: number) {
	if (contentFile.value?.type !== 'episodeFile') {
		return null;
	}
	const currEpFile = contentFile.value;
	const allEpisodes = parentTitle.value?.seasons
		.flatMap((season: any) => season.episodeFiles);
	let currentIndex = allEpisodes?.findIndex((episode: any) => episode.name === currEpFile.name);
	if (currentIndex === undefined || currentIndex === -1) {
		return null;
	}
	// iterate in direction for new episode number, in case of multiple versions of the same episode
	let nextEpFile = allEpisodes[currentIndex];
	while (nextEpFile && nextEpFile.seasonNumber === currEpFile.seasonNumber && nextEpFile.firstEpisodeNumber === currEpFile.firstEpisodeNumber) {
		currentIndex += delta;
		nextEpFile = allEpisodes[currentIndex];
	}
	return nextEpFile;
}

const nextEpisodeMetadata = computed(() => {
	if (nextEpisode.value?.type !== 'episode') {
		return null;
	}
	return parentTitle.value?.metadata?.seasons
		?.find((season: any) => season.seasonNumber === nextEpisode.value.seasonNumber)?.episodes
		?.find((episode: any) => episode.episodeNumber === nextEpisode.value?.episodeNumber);
});

const nextEpisodeTitle = computed(() => {
	if (!nextEpisode.value) {
		return '';
	}
	const metadataName = nextEpisodeMetadata?.value?.name;
	const nameIsNotEpisodeNumber = metadataName && !metadataName.toLowerCase().match(/episode \d{1,3}/);
	return nameIsNotEpisodeNumber ? ` "${metadataName}"` : nextEpisode.value.name;
});

const showEndingCards = ref(false);

const currentEpisodeMetadata = computed(() => {
	if (contentFile.value?.type !== 'episodeFile') {
		return null;
	}
	return parentTitle.value?.metadata?.seasons?.find((season: any) => season.seasonNumber === contentFile.value.seasonNumber)?.episodes
		.find((episode: any) => episode.episodeNumber === contentFile.value?.firstEpisodeNumber);
});

const currentSeason = computed(() => {
	return parentTitle.value?.seasons?.find(s => s.seasonNumber === contentFile.value?.seasonNumber || s.extras.some(e => e.relativePath === contentFile.value.relativePath))
});

const mediaInfo = computed(() => {
	if (contentFile.value?.type === 'episodeFile' && currentEpisodeMetadata.value) {
		return {
			name: currentEpisodeMetadata.value.name,
			episodeLabel: contentFile.value.name,
			...currentEpisodeMetadata.value,
			credits: {
				cast: parentTitle.value?.metadata?.credits.cast,
				guest_stars: currentEpisodeMetadata.value.credits.guest_stars,
				crew: currentEpisodeMetadata.value?.credits.crew,
			}
		};
	}
	if (contentFile.value?.type === 'movie') {
		return {
			name: contentFile.value.name,
			year: contentFile.value.year,
			...parentTitle.value?.metadata,
		}
	}
});

const videoTitle = computed(() => {
	if (!contentFile.value) {
		return '';
	}
	if (contentFile.value?.type === 'extra') {
		return contentFile.value.name + " - " + parentTitle.value?.folderName;
	}
	if (contentFile.value?.type === 'movie') {
		return `${contentFile.value.name} (${contentFile.value.year})`;
	}
	if (contentFile.value?.type === 'episodeFile') {
		const metadataName = currentEpisodeMetadata.value?.name;
		const nameIsNotEpisodeNumber = metadataName && !metadataName.toLowerCase().match(/episode \d{1,3}/);
		return (nameIsNotEpisodeNumber ? `"${metadataName}" ` : '') + `${contentFile.value?.name} - ${parentTitle.value?.name}`;
	}
	return contentFile.value.name;
});


watch(videoTitle, (newTitle) => {
	usePageTitleStore().setTitle(newTitle);
});



/****************
 * AUTOPLAY
 */
const autoplayTimes = ref(0);
const canAutoplay = computed(() => Boolean(nextEpisode.value));
const willAutoplay = computed(() => autoplayTimes.value > 0 && canAutoplay.value);
const timeTillAutoPlay = computed(() => (willAutoplay.value && playerProgress.value) ? Math.ceil(playerProgress.value.duration - playerProgress.value.time) : null);

function playPrev() {
	if (!prevEpisode.value) return;
	playMedia(prevEpisode.value!.relativePath);
}
function playNext() {
	if (!nextEpisode.value) return;
	if (willAutoplay.value) {
		autoplayTimes.value = Math.max(0, autoplayTimes.value - 1);
		toast.add({
			life: 5000,
			summary: `${autoplayTimes.value} auto-play${pluralize(autoplayTimes.value)} remaining`,
			severity: 'info',
		})
	}
	playMedia(nextEpisode.value!.relativePath);
}


/*************
 * MENU PANEL
 */

const menuPanelTrigger = ref<InstanceType<typeof NavTrigger> | null>(null);
const activeMenuPanel = ref('');
function closeMenuPanel() {
	activeMenuPanel.value = '';
}
watch(() => activeMenuPanel.value, async () => {
	if (!activeMenuPanel.value) {
		await menuPanelTrigger.value?.close();
	}
	else {
		await menuPanelTrigger.value?.open();
	}
})

const showDetailsPanel = computed(() => activeMenuPanel.value === 'details');
async function toggleDetailsMenu() {
	if (showDetailsPanel.value) {
		activeMenuPanel.value = '';
	}
	else {
		activeMenuPanel.value = 'details';
	}
}

const showScrubPanel = computed(() => activeMenuPanel.value === 'scrub');
async function toggleScrubMenu() {
	if (showScrubPanel.value) {
		activeMenuPanel.value = '';
	}
	else {
		activeMenuPanel.value = 'scrub';
	}
}

/****************
 * LOADING SPLASH
 */

const loadSplashUrl = computed(() => {
	const autoThumb = useApiStore().apiUrl + '/thumb/' + encodeMediaPath(queryPath.value) + '?width=1200&seek=3';
	if (contentFile.value?.type === 'extra') {
		return autoThumb;
	}
	return currentEpisodeMetadata.value?.still_full || parentTitle.value?.metadata?.background || parentTitle.value?.poster || autoThumb;
})


/************
 * TITLE CLICK
 */
function onTitleClick() {
	useQueryPathStore().goTo(parentTitle.value?.relativePath);
}



const personModal = ref<InstanceType<typeof PersonModal>>();
function openPersonModal(person) {
	personModal.value?.open(person.personId);
}


/**************
 * END SCREEN
 */

function goToEndScreen() {
	if (showEndScreen.value) {
		return;
	}
	showEndScreen.value = true;
	closeMenuPanel();
}

function leaveEndScreen(preventReturn = true) {
	if (!showEndScreen.value) {
		return;
	}
	if (preventReturn) {	
		userLeftEndScreen.value = true;
	}
	showEndScreen.value = false;
	useScreenStore().updateFocus();
}

const parentExtrasToShow = computed(() => {
	if (parentTitle.value?.cinemaType === 'movie') {
		const extras = parentTitle.value?.extras?.filter(e => e.relativePath !== contentFile.value?.relativePath);
		return extras?.length > 0 ? extras : undefined;
	}
	if (parentTitle.value?.cinemaType === 'series') {
		const lastSeason = parentTitle.value?.seasons?.peek();
		const lastEpFile = lastSeason?.episodeFiles.peek();

		// show series extras for very final episode or other series extra
		if (parentTitle.value?.extras?.some(e => e.relativePath === contentFile.value?.relativePath) || lastEpFile?.relativePath === contentFile.value?.relativePath) {
			const extras = parentTitle.value?.extras?.filter(e => e.relativePath !== contentFile.value?.relativePath);
			return extras?.length > 0 ? extras : undefined;
		}
	}
});

const seasonExtrasToShow = computed(() => {
	// only show extras on last episode of season
	if (currentSeason.value && (contentFile.value.type === 'extra' || contentFile.value?.episodeNumber === currentSeason.value?.episodeFiles?.peek()?.episodeNumber)) {
		const extras = currentSeason.value?.extras?.filter(e => e.relativePath !== contentFile.value?.relativePath);
		return extras?.length > 0 ? extras : undefined;
	}
})

const nextExtra = computed(() => {
	const extras = parentTitle.value?.extras || currentSeason.value?.extras;
	if (extras && contentFile.value.type === 'extra') {
		const idx = extras.findIndex(e => e.relativePath === contentFile.value.relativePath);
		return extras[idx + 1];
	}
})

const secondaryAudioOptions = computed(() => {
	return probe.value.audio.slice(1).map(track => ({
		label: track.name,
		value: track.index,
	}));
})



/************
 * TIMER
 */

const showTimer = ref(false);
function toggleTimer() {
	showTimer.value = !showTimer.value;
}

</script>

<template>
	<div class="fixed top-0 bottom-0 left-0 right-0" style="background: #000">
		<!-- loading screen -->
		<div class="absolute-full flex-center-all bg-contain" :style="{ backgroundImage: `url('${loadSplashUrl}')`}">
			<i class="pi pi-spin pi-spinner text-5xl" />
		</div>

		<div class="theater-wrapper md:flex-row flex-column">
			<div class="w-full flex-grow-1 relative">
				<div
					class="end-screen absolute top-0 bottom-0 left-0 right-0 flex-column"
					v-if="showEndScreen"
					:class="{ visible: showEndScreen }"
					:style="{ background: `radial-gradient(ellipse at top right, transparent, #000a max(40%, calc(100% - 50rem)), #000e 80%), url('${loadSplashUrl}') 40% 0% / cover no-repeat` }"
				>
					<div class="flex-grow-1 overflow-hidden">
						<Scroll>
							<div class="flex-column align-items-start gap-5" style="padding: max(1rem, 1%); min-height: 100vh">
								<div class="flex-column-center gap-1" style="zoom: 1.3">
									<div class="flex-row-center gap-1">
										<Button variant="text" severity="contrast" btn-blur-hover icon="pi pi-arrow-left" @click="carefulBackNav" />
										<div class="title text-ellipsis" :class="{ 'link': onTitleClick }" @click="onTitleClick">{{ videoTitle }}</div>
									</div>
									<Button variant="text" severity="contrast" btn-blur-hover icon="pi pi-replay" label="Replay" @click="() => playMedia(contentFile?.relativePath)" />
									<div v-if="secondaryAudioOptions.length">
										<Button variant="text" severity="contrast" btn-blur-hover :label="`Watch with '${ secondaryAudioOptions[0].label }'`" @click="() => useMediaStore().playMedia(contentFile?.relativePath, { restart: true, audioTrack: secondaryAudioOptions[0].value })">
											<template #icon><i class="material-symbols-outlined">movie_speaker</i></template>
										</Button>
									</div>
								</div>

								<div class="flex-grow-1" />

								<div v-if="nextEpisode">
									<h3>
										{{ nextEpisode.seasonNumber === contentFile.seasonNumber ? 'Next Episode' : 'Next Season' }}
										{{ (willAutoplay && playerProgress) ? `starting in ${timeTillAutoPlay}` : '' }}
									</h3>
									<div class="episode-item flex gap-3 mt-3">
										<div class="episode-poster-wrapper flex-shrink-0" style="width: min(250px, 30vw, 30vh);">
											<MediaCard
												navJumpRow="seasons"
												:imageUrl="nextEpisodeMetadata?.still_thumb"
												:aspectRatio="'wide'"
												:playSrc="nextEpisode.relativePath"
												:startTime="0"
												:progress="nextEpisode.watchProgress"
											>
												<template #fallbackIcon>📺</template>
											</MediaCard>
										</div>
										<div class="episode-info flex-grow-1">
											<div class="flex-column gap-2">
												<h3>{{ nextEpisodeTitle }}{{ nextEpisode.version ? ` (${nextEpisode.version})` : '' }}</h3>
												<div style="display: flex; gap: 10px; flex-wrap: wrap;">
													<span>Season {{ nextEpisode.seasonNumber }} Episode {{ nextEpisode.episodeNumber }}</span>
													<span v-if="nextEpisodeMetadata?.runtime">{{ formatRuntime_m(nextEpisodeMetadata?.runtime) }}</span>
													<span v-if="nextEpisodeMetadata?.content_rating">{{ nextEpisodeMetadata?.content_rating }}</span>
												</div>
											</div>
											
											<div class="mt-3 line-clamp-4" style="max-width: 30rem">
												{{ nextEpisodeMetadata?.overview }}
											</div>
										</div>
									</div>
								</div>

								<div v-if="nextExtra" class="w-full overflow-hidden">
									<h3>Next Extra</h3>
									<ExtrasList :extras="[nextExtra]" />
								</div>

								<div v-if="parentExtrasToShow" class="w-full overflow-hidden">
									<h3>{{ parentTitle?.name }} Extras</h3>
									<ExtrasList :extras="parentExtrasToShow" />
								</div>

								<div v-if="seasonExtrasToShow" class="w-full overflow-hidden">
									<h3>Season {{ currentSeason.seasonNumber }} Extras</h3>
									<ExtrasList :extras="seasonExtrasToShow" />
								</div>
							</div>
							
						</Scroll>
					</div>
				</div>

				<div v-show="showPlayer" class="main-video-wrapper flex-grow-1" :class="{ 'mini bg-blur-hover border-round overflow-hidden cursor-pointer': showEndScreen, focusAreaClass: !showEndScreen }" tabindex="0" @click="() => showEndScreen && leaveEndScreen()">
					<VideoPlayer
						ref="playerRef"
						:key="playablePath"
						:loadingSplash="loadSplashUrl"
						:title="videoTitle"
						:onTitleClick="onTitleClick"
						:close="carefulBackNav"
						:autoplay="true"
						:hideControls="showEndScreen"
						:relativePath="playablePath"
						:onLoadedData="() => hasLoaded = true"
						:onPlay="onPlay"
						:onPause="releaseWakeLock"
						:onEnd="onEnd"
						:onNextTrack="playNext"
						:onPrevTrack="playPrev"
						:subtitles="probe?.subtitles"
						:audio="probe?.audio"
						:chapters="probe?.chapters"
						allowFullscreen
						showTime
					>
						<template #topButtons>
							<!-- INFO BUTTON -->
							<Button
								text
								severity="contrast"
								@click="toggleDetailsMenu"
								v-if="mediaInfo"
							>
								<template #icon><span class="material-symbols-outlined">info</span></template>
							</Button>

							<!-- SCRUB BUTTON -->
							<Button
								:text="useScrubberStore().isScrubbing ? false : true"
								:severity="useScrubberStore().isScrubbing ? 'secondary' : 'contrast'"
								@click="toggleScrubMenu"
							>
								<template #icon><span class="material-symbols-outlined">mop</span></template>
							</Button>

							<!-- AUTOPLAY BUTTON -->
							<DropdownTrigger v-if="canAutoplay">
								<div class="autoplay" @click="">
									<Button :text="willAutoplay ? false : true" :severity="willAutoplay ? 'secondary' : 'contrast'">
										<template #icon>
											<span class="material-symbols-outlined">autoplay</span>
											<span v-if="autoplayTimes">&nbsp;{{ autoplayTimes }}</span>
										</template>
									</Button>
								</div>
								<template #content>
									<div class="p-2 flex-row-center">
										&nbsp;Autoplay:&nbsp;
										<div class="flex-row-center">
											<Button text icon="pi pi-arrow-down" @click="autoplayTimes = Math.max(0, autoplayTimes - 1)" />
											<div class="w-1rem text-center">{{ autoplayTimes }}</div>
											<Button text icon="pi pi-arrow-up" @click="autoplayTimes++" />
											<Button text icon="pi pi-trash" @click="autoplayTimes = 0" />
										</div>
									</div>
								</template>
							</DropdownTrigger>

							<!-- TIMER BUTTON -->
							<div class="timer-trigger" @click="toggleTimer">
								<Button :text="showTimer ? false : true" :severity="showTimer ? 'secondary' : 'contrast'" :icon="'pi pi-stopwatch'" />
							</div>
						</template>

						<template #permanentTop>
							<div v-if="showTimer" class="flex align-items-start">
								<div class="flex-grow-1"></div>
								<div><MediaTimer :mediaEl="playerRef?.videoRef" :inPlayer="true" /></div>
							</div>
						</template>

						<template #bottomButtons>
							<!-- PREV EPISODE BUTTON -->
							<Button v-if="prevEpisode" text severity="contrast" @click="playPrev">
								<template #icon><span class="material-symbols-outlined">skip_previous</span></template>
							</Button>
							<!-- NEXT EPISODE BUTTON -->
							<Button v-if="nextEpisode" text severity="contrast" @click="playNext">
								<template #icon><span class="material-symbols-outlined">skip_next</span></template>
							</Button>
						</template>

						<template #cards>
							<template v-if="showEndingCards && !showEndScreen">
								<Button v-if="nextEpisode" data-focus-priority="2" severity="secondary" class="next-episode-card text-lg" @click="playNext">
									<div class="play-icon">
										<div class="w-full">
											<MediaCard
												:imageUrl="nextEpisodeMetadata?.still_thumb"
												:aspectRatio="'wide'"
											>
												<template #fallbackIcon><i class="pi pi-play" /></template>
											</MediaCard>
										</div>
									</div>
									<div class="flex-column align-items-start">
										<div>
											Play Next
											<template v-if="willAutoplay">
												({{ timeTillAutoPlay }})
											</template>
										</div>
										<div style="opacity: .7">{{ nextEpisodeTitle }}</div>
									</div>
								</Button>
								<Button v-if="endScreenHasContent" severity="secondary" class="square text-lg" @click.stop="goToEndScreen">
									<i class="pi pi-window-maximize" />
								</Button>
							</template>
						</template>
					</VideoPlayer>
					<div v-if="showEndScreen" class="absolute-full" />
				</div>

			</div>

			<NavTrigger
				ref="menuPanelTrigger"
				triggerKey="movie-menu-panel"
				:onClose="() => activeMenuPanel = ''"
			>
				<template #default="{ show }">
					<div class="menu-panel" :class="{ ['md:w-23rem w-full md:h-full open']: show }">
						<!-- Non-shrinking contents -->
						<div class="panel-content md:w-23rem w-full">
							<template v-if="showScrubPanel">
								<div class="flex flex-column gap-2 h-full">
									<div class="flex align-items-center gap-1">
										<Button icon="pi pi-times" text severity="secondary" @click="closeMenuPanel" />
										<h3>Media Scrubs</h3>
										<div class="flex-grow-1"></div>
										<ToggleSwitch
											:modelValue="useScrubberStore().isScrubbing"
											@update:modelValue="(value) => value ? useScrubberStore().startScrubbing() : useScrubberStore().stopScrubbing()"
											:disabled="!useScrubberStore().activeProfile"
										/>
									</div>
									<div class="flex-grow-1 overflow-y-auto">
										<ScrubSettings :content="contentFile" />
									</div>
								</div>
							</template>

							<template v-else-if="showDetailsPanel && mediaInfo">
								<div class="flex flex-column gap-2 h-full">
									<div class="flex align-items-center gap-1">
										<Button icon="pi pi-times" text severity="secondary" @click="closeMenuPanel" />
									</div>
									<div class="flex-grow-1 overflow-y-auto flex flex-column gap-4">
										<div class="flex-column gap-1">
											<h2>{{ mediaInfo.name }}</h2>
											
											<div v-if="mediaInfo.episodeLabel">{{ mediaInfo.episodeLabel }}</div>
											<div v-if="mediaInfo.air_date">Aired: {{ mediaInfo.air_date }}</div>
											<div v-if="mediaInfo.year">{{ mediaInfo.year }}</div>
										</div>

										<div>{{ mediaInfo.overview }}</div>

										<template v-for="creditList, key in mediaInfo.credits">
											<div v-if="creditList.length" class="flex flex-column gap-2">
												<h3 style="text-transform: capitalize;">{{ (key as string).split('_').join(' ') }}</h3>
												<div v-for="person in creditList" class="flex-row-center gap-3 cursor-pointer" tabindex="0" @click="openPersonModal(person)">
													<div class="w-3 flex-shrink-0">
														<MediaCard
															:imageUrl="person.photo"
															aspectRatio="square"
														>
															<template #fallbackIcon><i class="material-symbols-outlined">person</i></template>
														</MediaCard>
													</div>

													<div class="flex-column gap-1 w-full overflow-hidden">
														<div class="font-bold text-ellipsis">{{ person.name }}</div>
														<div class="text-ellipsis">{{ person.role }}</div>
													</div>
												</div>
											</div>
										</template>
									</div>
								</div>
							</template>
						</div>
					</div>
				</template>
			</NavTrigger>
		
			<PersonModal ref="personModal" />
		</div>

	</div>
</template>

<style
	lang="scss"
	scoped
>
.theater-wrapper {
	height: 100%;
	position: relative;
	display: flex;

	.menu-panel {
		flex-shrink: 0;
		width: 0;
		height: 0;
		background: var(--color-background);
		transition: all 200ms;

		position: relative;
		overflow: hidden;

		&.open {
			/* height ratio on skinny screen */
			flex-grow: 3;
		}

		.panel-content {
			position: absolute;
			height: 100%;
			overflow-y: auto;
			overflow-x: hidden;

			padding: 1em;
		}
	}
}

.main-video-wrapper {
	top: 0;
	right: 0;
    width: 100%;
    bottom: 0;
	position: absolute;
	background-image: none;
	background-size: contain;
	background-position: center;
	background-repeat: no-repeat;
	background-color: black;
	transition: all 700ms;

	&.mini {
		--from-top: calc(1% + 4rem);
		--width: min(20rem, 35vw, 30vh);
		top: var(--from-top);
		right: 1rem;
		width: var(--width);
		bottom: calc(100% - var(--from-top) - (var(--width) * 2 / 3));
	}

	.next-episode-card {
		display: flex;
		align-items: center;
		gap: .5em;
		transition: font-size 500ms;

		&:hover, &[tv-focus] {
			box-shadow: 0 0 10px rgba(0, 0, 0, .5);
		}

		.play-icon {
			width: 4em;
			color: var(--color-contrast);
			display: flex;
			justify-content: center;
			align-items: center;
		}
	}
}

.end-screen {
	opacity: 0;
	pointer-events: none;
	transition: 1000ms;

	&.visible {
		opacity: 1;
		pointer-events: all;
	}

}
</style>
