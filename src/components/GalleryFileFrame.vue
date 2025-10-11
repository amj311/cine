<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useApiStore } from '@/stores/api.store';
import VideoPlayer from '@/components/VideoPlayer.vue';
import PinchZoom from 'pinch-zoom-js';

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
	zoom?: boolean;
	thumbnail?: boolean;
	loadSequence?: Array<'blur' | 'small' | 'medium' | 'large'>;
}>();

const sizeWidths = {
	blur: 5	,
	small: 200,
	medium: 800,
	large: 1200,
	xlarge: 2400,
};
const sizeWidth = computed(() => {
	return sizeWidths[props.size || 'small'] || 200;
});

function maxWidth(width: number) {
	return Math.min(window.innerWidth * 4, width);
}

const lowResUrl = computed(() => {
	return useApiStore().apiUrl + '/thumb/' + props.file.relativePath + '?width=' + maxWidth(sizeWidths[props.loadSequence?.[0] || ''] || sizeWidth.value);
});
const hiResUrl = computed(() => {
	const HI_RES_WIDTH = sizeWidths[props.loadSequence?.[1] || 'xlarge'];
	return useApiStore().apiUrl + '/thumb/' + props.file.relativePath + '?width=' + maxWidth(HI_RES_WIDTH);
});

const hiResReady = ref(false);
const mediaFrame = ref<HTMLElement | null>(null);
let pinchZoom: any = null;
const isZooming = ref(false);

onMounted(() => {
	if (props.loadSequence) {
		const img = new Image();
		img.src = hiResUrl.value;
		img.onload = () => {
			hiResReady.value = true;
		};
		img.onerror = () => {
			hiResReady.value = false;
		};
	}

	if (props.zoom && props.file.fileType === 'photo' && mediaFrame.value) {
		pinchZoom = new PinchZoom(mediaFrame.value, {
			draggableUnzoomed: false,
			minZoom: 1,
			maxZoom: 5,
			onZoomUpdate: (event: any) => {
				isZooming.value = event.zoomFactor > 1;
			},
		});
	}
});

onBeforeUnmount(() => {
	if (pinchZoom) {
		pinchZoom.disable();
	}
});

defineExpose({
	isZooming,
})

const showThumbnail = computed(() => {
	if (!props.thumbnail) {
		return false;
	}
	if (props.file.fileType === 'video' && props.file.relativePath.endsWith('.3gp')) {
		return false;
	}
	return true;
})

</script>

<template>
	<div style="position: relative; width: 100%; height: 100%;">
		<div class="media-frame" ref="mediaFrame" style="width: 100%; height: 100%;">
			<img 
				v-if="file.fileType === 'photo' || showThumbnail"
				:src="hiResReady ? hiResUrl : lowResUrl" 
				:alt="file.fileName" 
				style="width: 100%; height: 100%;"
				:style="{ objectFit }"
				:class="{ 'blurred': !hiResReady && loadSequence }"
			/>
			<VideoPlayer
				v-else-if="file.fileType === 'video'"
				:relativePath="file.relativePath"
				:hideControls="hideControls"
				:autoplay="autoplay"
				style="width: 100%; height: 100%;"
				:style="{ objectFit, background: 'transparent' }" 
			/>
		</div>
	</div>
</template>

<style scoped lang="scss">
.blurred {
	filter: blur(20px);
	transition: filter 0.5s ease;
}
</style>
