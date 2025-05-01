<script setup lang="ts">
import { computed } from 'vue';
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
}>();

const sizeWidths = {
	small: 200,
	medium: 800,
	large: 1200,
};
const sizeWidth = computed(() => {
	return sizeWidths[props.size || 'small'] || 200;
});

</script>

<template>
	<div class="media-frame" style="width: 100%; height: 100%;">
		<img 
			v-if="file.fileType === 'photo'"
			:src="useApiStore().baseUrl + '/thumb/' + file.relativePath + '?width=' + sizeWidth" 
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
