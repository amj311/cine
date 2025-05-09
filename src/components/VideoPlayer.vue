<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { defineProps, ref, computed, onMounted } from 'vue';

// Define the `src` prop
const props = defineProps<{
	relativePath: string;
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
}>();

const videoRef = ref<HTMLVideoElement>();
const videoUrl = computed(() => useApiStore().baseUrl + '/video?src=' + props.relativePath.split('&').join('<amp>'))

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
});

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
</script>

<template>
	<video ref="videoRef" class="video-player" :controls="!hideControls" :autoplay="autoplay" v-if="goodType" crossorigin="anonymous">
		<source :src="videoUrl" :type="'video/mp4'" />
		<track v-for="(track, i) in subtitleTracks" kind="captions" :src="track.url" srclang="en" :label="track.label" :default="i === 0 ? true : undefined" />
	</video>
</template>

<style scoped>
.video-player {
	width: 100%;
	height: 100%;
	/* object-fit: cover; */
	background-color: black;
}
</style>
