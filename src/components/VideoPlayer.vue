<script setup lang="ts">
import { baseURL } from '@/services/api';
import { defineProps, ref, computed, onMounted } from 'vue';

// Define the `src` prop
const props = defineProps<{
	src: string;
	onEnd?: () => void;
}>();

const videoRef = ref<HTMLVideoElement>();
const videoUrl = computed(() => baseURL + '/video?src=' + props.src.split('&').join('<amp>'))

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
			watchedAt: new Date(),
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
});
</script>

<template>
	<video ref="videoRef" :key="src" class="video-player" controls autoplay v-if="goodType">
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
