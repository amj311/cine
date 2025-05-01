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
}>();

const videoRef = ref<HTMLVideoElement>();
const videoUrl = computed(() => useApiStore().baseUrl + '/video?src=' + props.relativePath.split('&').join('<amp>'))

const supportedVideoTypes = [
	'mp4',
	'mkv',
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
</script>

<template>
	<video ref="videoRef" class="video-player" :controls="!hideControls" :autoplay="autoplay === true" v-if="goodType">
		<source :src="videoUrl" :type="'video/mp4'" />
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
