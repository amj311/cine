<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore } from '@/stores/watchProgress.store';
import { useToast } from 'primevue/usetoast';
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import MediaTimer from './MediaTimer.vue';
import { encodeMediaPath, msToTimestamp, secToMs } from '@/utils/miscUtils';
import { useFullscreenStore } from '@/stores/fullscreenStore.store';
import { useScreenStore } from '@/stores/screen.store';

const toast = useToast();

const props = defineProps<{
	relativePath: string;
	loadingSplash?: string,
	title?: string;
	onTitleClick?: () => void,
	close?: () => void;
	onPlay?: () => void;
	onPause?: () => void;
	onEnd?: () => void;
	onLoadedData?: (data: any) => void;
	hideControls?: boolean;
	autoplay?: boolean;
	loadSubs?: boolean;
	subtitles?: Array<{
		index: number;
		foramt: string;
		name?: string;
	}>;
	audio?: Array<{
		index: number;
		foramt: string;
		name?: string;
	}>;
}>();

const showControlsTime = 2500;
const hideControlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const showControls = ref(false);
function doShowControls() {
	if (hideControlsTimeout.value) {
		clearTimeout(hideControlsTimeout.value);
	}
	setTimeout(() => {
		showControls.value = true;
	}, 100)
	hideControlsTimeout.value = setTimeout(() => {
		showControls.value = false;
	}, showControlsTime);
} 

const videoRef = ref<HTMLVideoElement>();
const videoUrl = computed(() => useApiStore().apiUrl + '/stream?src=' + encodeMediaPath(props.relativePath));
const secondaryAudioPlayer = ref<HTMLAudioElement>();

const supportedVideoTypes = [
	'mp4',
	'mkv',
	'3gp',
];

const goodType = computed(() => {
	return supportedVideoTypes.find(type => videoUrl.value.endsWith(type));
});

defineExpose({
	videoRef,
	showControls,
	getProgress() {
		if (!videoRef.value) {
			console.warn("Video element is not rendered yet")
			return;
		}
		return useWatchProgressStore().createProgress(videoRef.value.currentTime, videoRef.value.duration);
	},
	setTime(time) {
		videoRef.value!.currentTime = time;
	},

	async play() {
		await videoRef.value?.play();
	},
})

const playingState = ref({
	paused: false,
	ended: false,
	currentTime: 0,
	progress: 0,
});

function updatePlayingState() {
	if (!videoRef.value) {
		return;
	}
	playingState.value.paused = videoRef.value.paused;
	playingState.value.ended = videoRef.value.ended;
	playingState.value.currentTime = videoRef.value.currentTime;
	playingState.value.progress = videoRef.value.duration ? videoRef.value.currentTime * 100 / videoRef.value.duration : 0;
}

function loopUpdateState() {
	window.requestAnimationFrame(() => {
		updatePlayingState();
		loopUpdateState();
	})
}

const hasLoaded = ref(false);

onMounted(() => {
	loopUpdateState();

	videoRef.value?.addEventListener('loadeddata', () => {
		hasLoaded.value = true;
		updatePlayingState();
		if (props.onLoadedData) {
			props.onLoadedData(videoRef.value);
		}
	});
	videoRef.value?.addEventListener('pause', async () => {
		await secondaryAudioPlayer.value?.pause();
		if (props.onPause) {
			props.onPause();
		}
	});
	videoRef.value?.addEventListener('play', async () => {
		await secondaryAudioPlayer.value?.play();
		secondaryAudioPlayer.value!.currentTime = videoRef.value!.currentTime;
		if (props.onPlay) {
			props.onPlay();
		}
	});
	videoRef.value?.addEventListener('ended', () => {
		if (props.onEnd) {
			props.onEnd();
		}
	});
	videoRef.value?.addEventListener('seeked', () => {
		if (secondaryAudioPlayer.value) {
			secondaryAudioPlayer.value.currentTime = videoRef.value!.currentTime;
		}
	});
	// don't pause when touching whole area on touch screen
	if (!useScreenStore().detectedTouch) {
		videoRef.value?.addEventListener('click', togglePlay);
	}
	videoRef.value?.addEventListener('click', doubleClick);

	doShowControls();

	// Setup control hiding
	const events = ['mousemove', 'keydown', 'touchstart'];
	events.forEach((event) => {
		window.addEventListener(event, doShowControls, { passive: true });
	});

	// setup keybindings
	window.addEventListener('keydown', windowKeyHandler);
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', windowKeyHandler);
})

function windowKeyHandler(e) {
	// not for TVs
	if (useScreenStore().detectedTv) {
		return;
	}

	if (e.key === ' ') {
		togglePlay();
	}
	if (e.key === 'ArrowLeft') {
		skipBack();
	}
	if (e.key === 'ArrowRight') {
		skipForward();
	}
}

let lastClick = 0;
function doubleClick() {
	const doubleClickTime = 500;
	if (Date.now() - lastClick < doubleClickTime) {
		useFullscreenStore().userToggle();
	}
	lastClick = Date.now();
}

const isPlaying = computed(() => !playingState.value.paused && !playingState.value.ended);
function togglePlay() {
	if (videoRef.value?.ended || videoRef.value?.paused) {
		videoRef.value.play();
	}
	else {
		videoRef.value?.pause();
	}
	doShowControls();
}

function skipBack() {
	if (videoRef.value) {
		videoRef.value.currentTime -= 10;
	}
	doShowControls();
}

function skipForward() {
	if (videoRef.value) {
		videoRef.value.currentTime = Math.min(videoRef.value.currentTime + 10, videoRef.value.duration - 1);
	}
	doShowControls();
}

function doRangeSeek(percent: number) {
	if (!videoRef.value) {
		return;
	}
	const progress = Math.min(99.99, percent);
	videoRef.value.currentTime = videoRef.value.duration * progress / 100;
}

const remaining = computed(() => {
	if (!videoRef.value) {
		return 0;
	}
	return videoRef.value.duration - playingState.value.currentTime;
})

const subtitleTracks = computed(() => {
	if (!props.subtitles?.length) {
		return [];
	}
	return props.subtitles.map((track, i) => ({
		index: track.index,
		label: track.name || 'Subtitle ' + (i + 1),
		url: useApiStore().apiUrl + '/subtitles?path=' + encodeMediaPath(props.relativePath) + '&index=' + track.index,
	}));
});

// 0 means default audio, don't load secondary
const selectedAudioIndex = ref(0);
const secondaryAudio = computed(() => {
	if (!props.audio?.length) {
		return null;
	}
	if (selectedAudioIndex.value === 0) {
		return null;
	}
	return props.audio[selectedAudioIndex.value];
})
const loadingAudio = ref(false);

watch(secondaryAudio, (audio) => {
	if (!videoRef.value) {
		return;
	}
	if (audio) {
		turnOnSecondaryAudio(audio);
	} else {
		turnOffSecondaryAudio();
	}
}, { immediate: true });

async function turnOffSecondaryAudio() {
	if (!videoRef.value) {
		return;
	}
	videoRef.value.muted = false;
	await secondaryAudioPlayer.value?.pause();
	secondaryAudioPlayer.value!.src = '';
}
async function turnOnSecondaryAudio(audio) {
	if (!videoRef.value) {
		console.warn('videoRef is not set');
		return;
	}
	const audioPlayer = secondaryAudioPlayer.value;
	if (audioPlayer) {
		try {
			loadingAudio.value = true;
			toast.add({
				severity: 'info',
				summary: 'Preparing Audio',
				detail: 'This may take a few minutes...',
			});
			await useApiStore().api.post('/prepareAudio', {
				src: props.relativePath,
				index: audio.index,
			});
			audioPlayer.src = useApiStore().apiUrl + '/assets/conversion.mp3';
			await audioPlayer.play();
			audioPlayer.currentTime = videoRef.value.currentTime;
			videoRef.value.muted = true;
			loadingAudio.value = false;
			toast.removeAllGroups();
			toast.add({
				severity: 'success',
				summary: 'Audio Ready',
				detail: 'Audio is ready to play',
				life: 2000,
			});
		}
		catch (e) {
			console.error('Error turning on secondary audio', e);
			toast.removeAllGroups();
			toast.add({
				severity: 'error',
				summary: 'Error Preparing Audio',
				detail: 'There was an error preparing the audio. Please try again.',
			});
			loadingAudio.value = false;
			turnOffSecondaryAudio();
		}		
	}
}

const audioMenuItems = computed(() => {
	if (!props.audio?.length) {
		return [];
	}
	return props.audio.map((audio, i) => ({
		label: audio.name || (i === 0 ? 'Default' : 'Audio ' + (i + 1)),
		icon: i === selectedAudioIndex.value ? 'pi pi-check' : 'pi',
		command: () => {
			selectedAudioIndex.value = i;
		},
	}));
});

const showTimer = ref(false);
function toggleTimer() {
	showTimer.value = !showTimer.value;
}

</script>

<template>
	<div class="wrapper" ref="wrapperRef" :class="{ 'show-controls tvNavigationNoFocus': showControls && !hideControls }">
		<video ref="videoRef" class="video-player" :controls="false" :autoplay="autoplay" v-if="goodType" crossorigin="anonymous" allow>
			<source :src="videoUrl" :type="'video/mp4'" />
			<track v-for="(track, i) in subtitleTracks" kind="captions" :src="track.url" srclang="en" :label="track.label" :default="i === 0 ? true : undefined" />
		</video>
		<audio ref="secondaryAudioPlayer" type="audio/mp3" />

		<div v-if="!hasLoaded" class="loading-splash">
			<img v-if="loadingSplash" :src="loadingSplash" />
			<i class="pi pi-spin pi-spinner text-7xl" />
		</div>
		<div class="overlay overlay-fade"></div>

		<div class="top-controls w-full flex flex-column justify-content-end">
			<div class="overlay flex align-items-center gap-2">
				<Button v-if="close" variant="text" severity="contrast" icon="pi pi-arrow-left" @click="close" />
				<div class="title text-ellipsis" :class="{ clickable: onTitleClick }" @click="onTitleClick">{{ title }}</div>
				<div class="flex-grow-1"></div>
				<div class="flex align-items-center">
					<slot name="topButtons"></slot>
					<div class="timer-trigger" @click="toggleTimer">
						<Button :text="showTimer ? false : true" :severity="showTimer ? 'secondary' : 'contrast'" :icon="'pi pi-stopwatch'" />
					</div>
				</div>
			</div>
			<div v-if="showTimer" class="flex align-items-start">
				<div class="flex-grow-1"></div>
				<div><MediaTimer :mediaEl="videoRef" :inPlayer="true" /></div>
			</div>
		</div>
		<div v-if="hasLoaded" class="center-controls overlay flex-row-center gap-4">
			<Button class="square" text severity="contrast" @click="skipBack">
				<i class="material-symbols-outlined">fast_rewind</i>
			</Button>
			<div data-focus-priority="1" class="clickable square border-circle w-3rem bg-white-alpha-70 flex-center-all cursor-pointer no-select" @click="togglePlay">
				<i class="material-symbols-outlined">{{ isPlaying ? 'pause' : 'play_arrow' }}</i>
			</div>
			<Button class="square" text severity="contrast" @click="skipForward">
				<i class="material-symbols-outlined">fast_forward</i>
			</Button>
		</div>
		<div class="bottom-controls overlay flex-column gap-2">
			<div class="flex-row-center">
				<span>-{{ msToTimestamp(secToMs(remaining)) }}</span>
				<div class="flex-grow-1" />
				<slot name="bottomButtons"></slot>
				<div class="audio-select" v-if="props.audio && props.audio.length > 1">
					<DropdownMenu :items="audioMenuItems">
						<Button variant="text" severity="contrast"><span class="material-symbols-outlined">movie_speaker</span></Button>
					</DropdownMenu>
				</div>
				<Button text severity="contrast" @click="useFullscreenStore().userToggle">
					<span class="material-symbols-outlined">{{ useFullscreenStore().isAppInFullscreenMode ? 'fullscreen_exit' : 'fullscreen' }}</span>
				</Button>
			</div>
			<input type="range" class="seeker w-full" min="0" :value="playingState.progress" @input="(e: any) => doRangeSeek(e?.target?.value)" />
		</div>
		<div class="cards" :class="{ lift: showControls }">
			<slot name="cards" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;

	.video-player {
		width: 100%;
		height: 100%;
		/* object-fit: cover; */
		background-color: black;
	}
	.overlay {
		color: #fff !important;
		opacity: 0;
		transition: 500ms;
		zoom: 1.3;
		z-index: 1000;
		pointer-events: none;
		text-shadow: 0 0 5px #0006;
	}
	&.show-controls {
		.overlay {
			opacity: 1;

			> * {
				pointer-events: all;
			}
		}
	}

	.overlay-fade {
		background: linear-gradient(to bottom, rgba(0, 0, 0, .65), rgba(0, 0, 0, 0) 3em),
			linear-gradient(to top, rgba(0, 0, 0, .65), rgba(0, 0, 0, 0) 8em);
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.top-controls {
		position: absolute;
		top: 0px;
		left: 00px;
	}

	.center-controls {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
	}

	.bottom-controls {
		position: absolute;
		bottom: 0px;
		left: 0px;
		right: 0px;
		padding: 1rem;
	}

	.loading-splash {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		text-shadow: 0 0 5px #0006;

		img {
			object-fit: contain;
			height: 100%;
			width: 100%;
		}

		.pi-spinner {
			position: absolute;
			top: 50%;
			left: 50%;
			translate: -50% -50%;
		}
	}


	.cards {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		transition: bottom 500ms;

		&.lift {
			bottom: 7rem;
		}
	}


	.title.clickable {
		cursor: pointer;

		&:hover {
			text-decoration: underline;
		}
	}
}
</style>
