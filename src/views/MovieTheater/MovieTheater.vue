<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useRoute, useRouter } from 'vue-router';
import { useScreenStore } from '@/stores/screen.store';
import { useBackgroundStore } from '@/stores/background.store';
import { usePageTitleStore } from '@/stores/pageTitle.store';
import { useFullscreenStore } from '@/stores/fullscreenStore.store';
import MediaCard from '@/components/MediaCard.vue';
import { useWatchProgressStore } from '@/stores/watchProgress.store';
import { useToast } from 'primevue/usetoast';
import { useApiStore } from '@/stores/api.store';
import { useScrubberStore } from './scrubber.store';
import ScrubSettings from './ScrubSettings.vue';
import DropdownTrigger from '@/components/utils/DropdownTrigger.vue';
import { encodeMediaPath, formatRuntime_m } from '@/utils/miscUtils';
import type NavTrigger from '@/components/utils/NavTrigger/NavTrigger.vue';
import ToggleSwitch from '@/components/utils/ToggleSwitch.vue';
import PersonModal from '@/components/PersonModal.vue';
import Scroll from '@/components/Scroll.vue';
import ExtrasList from '@/components/ExtrasList.vue';
import { useMediaStore } from '@/stores/media.store';

const router = useRouter();
const api = useApiStore().api;

const mediaPath = computed(() => useMediaStore().currentPath as string);
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const didAutoFullscreen = ref(false);
const hasLoaded = ref(false);
const hasEnded = ref(false);
const showEndScreen = ref(false);
const playerProgress = ref<any>(null); // WatchProgress type

const showPlayer = computed(() => {
	return Boolean(mediaPath.value);
});

const isLoadingLibrary = ref(false);
const parentLibrary = ref<any>(null);
const playable = ref<any>(null);
const probe = ref<any>(null);

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
		probe.value = data.data.probe;

		parentLibrary.value.metadata = await MetadataService.getMetadata(parentLibrary.value, true);

		// if (parentLibrary.value.metadata?.background) {
		// 	useBackgroundStore().setBackgroundUrl(parentLibrary.value.metadata.background);
		// }

		// consider this a new movie and reset the timer
		await api.put('/timer/reset');
	} catch (error) {
		console.error('Error loading media data', error);
	} finally {
		isLoadingLibrary.value = false;
	}
}

const route = useRoute();

async function initialProgress() {
	if (!mediaPath.value) {
		return;
	}
	const query = route?.query;
	if (query.startTime) {
		playerRef.value?.setTime(Number(query.startTime));
		// remove route start time
		history.replaceState(
			{},
			'',
			route.path + '?' + new URLSearchParams({ ...(route.query || {}), startTime: '' }).toString(),
		)
		return;
	}

	let watchProgress = playable.value.watchProgress;
	if (!watchProgress) {
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
			console.error("error loading watchProgress", e)
		}
	}

	if (watchProgress && watchProgress.time < watchProgress.duration) {
		playerRef.value?.setTime(playable.value.watchProgress.time);
		return;
	}
}

let wakeLock: WakeLockSentinel | null = null;

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

async function playMedia(pathToLoad: string, restart = false) {
	useMediaStore().playMedia(pathToLoad);

	nextTick(async () => {
		if (!restart) {
			await initialProgress();
		}
	})
}


watch(() => mediaPath.value, async () => {
	if (!mediaPath.value) {
		return;
	}
	const pathToLoad = mediaPath.value;
	// history.replaceState(
	// 	{},
	// 	'',
	// 	router.currentRoute.value.path + '?' + new URLSearchParams({ ...(router.currentRoute.value.query || {}), path: pathToLoad }).toString(),
	// );
	
	playerRef.value?.setTime(0);
	playerProgress.value = playerRef.value?.getProgress();
	hasEnded.value = false;
	hasLoaded.value = false;
	showEndScreen.value = false;

	await loadMediaData(pathToLoad);

	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: videoTitle.value,
			album: parentLibrary.value?.name,
			artist: parentLibrary.value?.name,
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
		}
	})
}, {
	immediate: true,
})

onMounted(async () => {
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
		mediaPath.value,
		useWatchProgressStore().createProgress(finishedTime, finishedTime),
	);

	releaseWakeLock();

	if (willAutoplay.value) {
		return playNext();
	}
	else if (nextEpisode.value || parentExtrasToShow.value || seasonExtrasToShow.value) {
		showEndScreen.value = true;
	}
	else {
		carefulBackNav();
	}
}

const PROGRESS_INTERVAL = 1000 * 5;
let lastPostTime = 0;
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
	if (!lastPostTime || Math.abs(playerProgress.value?.time - lastPostTime) > POST_INTERVAL) {
		try {
			if (!playerProgress.value) {
				return;
			}
			await useWatchProgressStore().postProgress(
				mediaPath.value,
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


/***************
 * METADATA
 */

const nextEpisode = computed(() => findNextEpisode(1)?.episodes[0]);
const prevEpisode = computed(() => findNextEpisode(-1)?.episodes[0]);

function findNextEpisode(delta: number) {
	if (playable.value?.type !== 'episodeFile') {
		return null;
	}
	const currEpFile = playable.value;
	const allEpisodes = parentLibrary.value?.seasons
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
	return parentLibrary.value?.metadata?.seasons
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

const showNextEpisodeCard = computed(() => {
	return Boolean(nextEpisode.value && (playerProgress.value?.duration - playerProgress.value?.time < 30));
});

const currentEpisodeMetadata = computed(() => {
	if (playable.value?.type !== 'episodeFile') {
		return null;
	}
	return parentLibrary.value?.metadata?.seasons?.find((season: any) => season.seasonNumber === playable.value.seasonNumber)?.episodes
		.find((episode: any) => episode.episodeNumber === playable.value?.firstEpisodeNumber);
});

const currentSeason = computed(() => {
	return parentLibrary.value?.seasons?.find(s => s.seasonNumber === playable.value?.seasonNumber || s.extras.some(e => e.relativePath === playable.value.relativePath))
});

const mediaInfo = computed(() => {
	if (playable.value?.type === 'episodeFile' && currentEpisodeMetadata.value) {
		return {
			name: currentEpisodeMetadata.value.name,
			episodeLabel: playable.value.name,
			...currentEpisodeMetadata.value,
			credits: {
				cast: parentLibrary.value?.metadata?.credits.cast,
				guest_stars: currentEpisodeMetadata.value.credits.guest_stars,
				crew: currentEpisodeMetadata.value?.credits.crew,
			}
		};
	}
	if (playable.value?.type === 'movie') {
		return {
			name: playable.value.name,
			year: playable.value.year,
			...parentLibrary.value?.metadata,
		}
	}
});

const videoTitle = computed(() => {
	if (!playable.value) {
		return '';
	}
	if (playable.value?.type === 'extra') {
		return playable.value.name + " - " + parentLibrary.value.folderName;
	}
	if (playable.value?.type === 'movie') {
		return `${playable.value.name} (${playable.value.year})`;
	}
	if (playable.value?.type === 'episodeFile') {
		const metadataName = currentEpisodeMetadata.value?.name;
		const nameIsNotEpisodeNumber = metadataName && !metadataName.toLowerCase().match(/episode \d{1,3}/);
		return (nameIsNotEpisodeNumber ? `"${metadataName}" ` : '') + `${playable.value?.name} - ${parentLibrary.value?.name}`;
	}
	return playable.value.name;
});


watch(videoTitle, (newTitle) => {
	usePageTitleStore().setTitle(newTitle);
});



/****************
 * AUTOPLAY
 */
const autoplayTimes = ref(0);
const canAutoplay = computed(() => Boolean(nextEpisode.value));
const willAutoplay = computed(() => autoplayTimes.value > 0 && canAutoplay.value && !hasEnded.value);

function playPrev() {
	if (!prevEpisode.value) return;
	playMedia(prevEpisode.value!.relativePath, true);
}
function playNext() {
	if (!nextEpisode.value) return;
	autoplayTimes.value = Math.max(0, autoplayTimes.value - 1);
	playMedia(nextEpisode.value!.relativePath, true);
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
	if (playable.value?.type === 'extra') {
		return useApiStore().apiUrl + '/thumb/' + encodeMediaPath(mediaPath.value) + '?width=1200';
	}
	return currentEpisodeMetadata.value?.still_full || parentLibrary.value?.metadata?.background;
})


/************
 * TITLE CLICK
 */
function onTitleClick() {
	useQueryPathStore().goTo(parentLibrary.value.relativePath);
}



const personModal = ref<InstanceType<typeof PersonModal>>();
function openPersonModal(person) {
	personModal.value?.open(person.personId);
}


/**************
 * END SCREEN
 */
const parentExtrasToShow = computed(() => {
	if (parentLibrary.value?.cinemaType === 'movie') {
		const extras = parentLibrary.value?.extras?.filter(e => e.relativePath !== playable.value?.relativePath);
		return extras?.length > 0 ? extras : undefined;
	}
});

const seasonExtrasToShow = computed(() => {
	// only show extras on last episode of season
	if (currentSeason.value && (playable.value.type === 'extra' || playable.value?.episodeNumber === currentSeason.value?.episodes?.pop()?.episodeNumber)) {
		const extras = currentSeason.value?.extras?.filter(e => e.relativePath !== playable.value?.relativePath);
		return extras?.length > 0 ? extras : undefined;
	}
})

</script>

<template>
	<div class="fixed top-0 bottom-0 left-0 right-0" style="background: #000">
		<div v-if="!showEndScreen" class="theater-wrapper md:flex-row flex-column">
			<div class="movie-theater flex-grow-1">
				<VideoPlayer
					v-if="mediaPath"
					:key="mediaPath"
					v-show="showPlayer"
					:loadingSplash="loadSplashUrl"
					:title="videoTitle"
					:onTitleClick="onTitleClick"
					:close="carefulBackNav"
					:autoplay="true"
					:controls="true"
					ref="playerRef"
					:relativePath="mediaPath"
					:onLoadedData="() => hasLoaded = true"
					:onPlay="onPlay"
					:onPause="releaseWakeLock"
					:onEnd="onEnd"
					:onNextTrack="playNext"
					:onPrevTrack="playPrev"
					:subtitles="probe?.subtitles"
					:audio="probe?.audio"
					:chapters="probe?.chapters"
					timer
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
						<Button v-if="showNextEpisodeCard" data-focus-priority="2" severity="secondary" class="next-episode-card" :class="{ 'text-2xl': hasEnded }" @click="playNext">
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
							<div>
								<div class="flex align-items-ceter gap-1">
									<span v-if="willAutoplay">
										<span class="material-symbols-outlined">autoplay</span>
										Autoplay ({{ autoplayTimes }})
									</span>
									<span v-else>Play Next</span>
								</div>
								<div style="opacity: .7">{{ nextEpisodeTitle }}</div>
							</div>
						</Button>
					</template>
				</VideoPlayer>
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
										<ScrubSettings :playable="playable" />
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

		<div
			class="end-screen absolute top-0 bottom-0 left-0 right-0 flex-column"
			:class="{ visible: showEndScreen }"
			:style="{ background: `radial-gradient(ellipse at top right, transparent, #000a max(40%, calc(100% - 50rem)), #000e 80%), url('${loadSplashUrl}') 40% 0% / cover no-repeat` }"
		>
			<div class="flex-grow-1 overflow-hidden">
				<Scroll>
					<div class="h-full flex-column align-items-start gap-5" style="padding: max(2rem, 3%)">
						<div>
							<Button style="zoom: 1.3" variant="text" severity="contrast" icon="pi pi-arrow-left" label="Return" @click="carefulBackNav" />
							<br />
							<Button style="zoom: 1.3" variant="text" severity="contrast" icon="pi pi-replay" label="Replay" @click="showEndScreen = false" />
						</div>

						<div class="flex-grow-1" />

						<div v-if="nextEpisode">
							<h2>{{ nextEpisode.seasonNumber === playable.seasonNumber ? 'Next Episode' : 'Begin Next Season' }}</h2>
							<div class="episode-item flex gap-3 mt-3">
								<div class="episode-poster-wrapper flex-shrink-0" style="width: min(250px, 30vw)">
									<MediaCard
										navJumpRow="seasons"
										:imageUrl="nextEpisodeMetadata?.still_thumb"
										:aspectRatio="'wide'"
										:playSrc="nextEpisode.relativePath"
										:overrideStartTime="nextEpisode.startTime"
										:progress="nextEpisode.watchProgress"
										:tvNavable="true"
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

						<div v-if="parentExtrasToShow" class="w-full overflow-hidden">
							<h2>Extras</h2>
							<ExtrasList :extras="parentExtrasToShow" />
						</div>

						<div v-if="seasonExtrasToShow" class="w-full overflow-hidden">
							<h2>Season {{ currentSeason.seasonNumber }} Extras</h2>
							<ExtrasList :extras="seasonExtrasToShow" />
						</div>
					</div>
				</Scroll>
			</div>
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

.movie-theater {
    width: 100%;
	position: relative;
	background-image: none;
	background-size: contain;
	background-position: center;
	background-repeat: no-repeat;
	background-color: black;

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
	transition: 500ms;

	&.visible {
		opacity: 1;
		pointer-events: all;
	}
}
</style>
