<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useApiStore } from '@/stores/api.store';
import VideoPlayer from '@/components/VideoPlayer.vue';

export type GalleryFile = {
	fileType: 'video' | 'photo' | 'audio';
	relativePath: string;
	fileName: string;
	takenAt: string;
}

const props = defineProps<{
	file: GalleryFile;
	objectFit: 'cover' | 'contain';
	hideControls?: boolean;
	autoplay?: boolean;
	size?: 'small' | 'medium' | 'large';
	sequentialLoad?: boolean;
}>();

const sizeWidths = {
	small: 100,
	medium: 800,
	large: 1200,
};
const sizeWidth = computed(() => {
	return Math.min(window.innerWidth * 2, sizeWidths[props.size || 'small'] || 200);
});

const lowResUrl = computed(() => {
	return useApiStore().baseUrl + '/thumb/' + props.file.relativePath + '?width=' + sizeWidth.value;
});
const hiResUrl = computed(() => {
	return useApiStore().baseUrl + '/media/' + props.file.relativePath;
});

const hiResReady = ref(false);
onMounted(() => {
	if (props.sequentialLoad && props.file.fileType === 'photo') {
		const img = new Image();
		img.src = hiResUrl.value;
		img.onload = () => {
			hiResReady.value = true;
		};
		img.onerror = () => {
			hiResReady.value = false;
		};
	}
});

</script>

<template>
	<div class="media-frame" style="width: 100%; height: 100%;">
		<img 
			v-if="file.fileType === 'photo'"
			:src="hiResReady ? hiResUrl : lowResUrl" 
			:alt="file.fileName" 
			style="width: 100%; height: 100%;"
			:style="{ objectFit }" 
		/>
		<VideoPlayer
			v-if="file.fileType === 'video'"
			:relativePath="file.relativePath"
			:hideControls="hideControls"
			:autoplay="autoplay"
			style="width: 100%; height: 100%;"
			:style="{ objectFit }" 
		/>
	</div>
</template>

<style scoped lang="scss">
</style>
