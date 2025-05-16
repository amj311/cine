<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import { defineProps, ref, computed, onMounted, watch } from 'vue';

const toast = useToast();

const props = defineProps<{
	relativePath: string;
	title?: string;
	close?: () => void;
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

const wrapperRef = ref<HTMLDivElement>();
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

const videoRef = ref<HTMLVideoElement>();
const videoUrl = computed(() => useApiStore().baseUrl + '/video?src=' + props.relativePath.split('&').join('<amp>'))
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
	getProgress() {
		if (!videoRef.value) {
			console.warn("Video element is not rendered yet")
			return;
		}
		return {
			time: videoRef.value.currentTime,
			duration: videoRef.value.duration,
			percentage: parseInt((videoRef.value.currentTime / videoRef.value.duration * 100).toFixed(5)),
			watchedAt: Date.now(),
		};
	},
	setTime(time) {
		videoRef.value!.currentTime = time;
	},

	play() {
		videoRef.value?.play();
	},
})

onMounted(() => {
	videoRef.value?.addEventListener('ended', () => {
		if (props.onEnd) {
			props.onEnd();
		}
	});
	videoRef.value?.addEventListener('loadeddata', () => {
		if (props.onLoadedData) {
			props.onLoadedData(videoRef.value);
		}
	});
	videoRef.value?.addEventListener('pause', () => {
		secondaryAudioPlayer.value?.pause();
	});
	videoRef.value?.addEventListener('play', () => {
		secondaryAudioPlayer.value?.play();
		secondaryAudioPlayer.value!.currentTime = videoRef.value!.currentTime;
	});
	videoRef.value?.addEventListener('seeked', () => {
		if (secondaryAudioPlayer.value) {
			secondaryAudioPlayer.value.currentTime = videoRef.value!.currentTime;
		}
	});

	updateShowControlsTimeout();

	// Setup control hiding
	const events = ['mousemove', 'keydown', 'touchstart'];
	events.forEach((event) => {
		wrapperRef.value?.addEventListener(event, updateShowControlsTimeout, { passive: true });
	});
})


const subtitleTracks = computed(() => {
	if (!props.subtitles?.length) {
		return [];
	}
	return props.subtitles.map((track, i) => ({
		index: track.index,
		label: track.name || 'Subtitle ' + (i + 1),
		url: useApiStore().baseUrl + '/subtitles?path=' + props.relativePath + '&index=' + track.index,
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

function turnOffSecondaryAudio() {
	if (!videoRef.value) {
		return;
	}
	videoRef.value.muted = false;
	secondaryAudioPlayer.value?.pause();
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
			audioPlayer.src = useApiStore().baseUrl + '/assets/conversion.mp3';
			audioPlayer.play();
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
</script>

<template>
	<div class="wrapper" ref="wrapperRef" :class="{ 'show-controls': showControls }">
		<video ref="videoRef" class="video-player" :controls="!hideControls" :autoplay="autoplay" v-if="goodType" crossorigin="anonymous">
			<source :src="videoUrl" :type="'video/mp4'" />
			<track v-for="(track, i) in subtitleTracks" kind="captions" :src="track.url" srclang="en" :label="track.label" :default="i === 0 ? true : undefined" />
		</video>
		<audio ref="secondaryAudioPlayer" type="audio/mp3" />
		<div class="overlay top-fade"></div>
		<div class="top-left overlay w-full">
			<Button v-if="close" variant="text" severity="contrast" icon="pi pi-arrow-left" @click="close" />
			<div>{{ title }}</div>
			<div class="flex-grow-1"></div>
			<div class="audio-select" v-if="props.audio?.length">
				<DropdownMenu :model="audioMenuItems"><Button variant="text" severity="contrast" :icon="'pi pi-headphones'" /></DropdownMenu>
			</div>
		</div>
	</div>
</template>

<style scoped>
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
		top: 0px;
		left: 00px;
		z-index: 1000;
		display: flex;
		gap: .5em;
		align-items: center;
	}
}
</style>
