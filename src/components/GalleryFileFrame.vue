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
	videoBackground?: string,
	videoSeeker?: HTMLInputElement,
}>();

const sizeWidths = {
	blur: 5,
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

const isLoading = ref(true);
const baseUrl = computed(() => useApiStore().apiUrl + '/thumb/' + props.file.relativePath);
const lowResUrl = computed(() => {
	return baseUrl.value + '?width=' + maxWidth(sizeWidths[props.loadSequence?.[0] || ''] || sizeWidth.value);
});
const hiResUrl = computed(() => {
	const HI_RES_WIDTH = sizeWidths[props.loadSequence?.[1] || 'xlarge'];
	return baseUrl.value + '?width=' + maxWidth(HI_RES_WIDTH);
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
			maxZoom: 10,
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

const showThumbnail = computed(() => {
	if (!props.thumbnail) {
		return false;
	}
	if (props.file.fileType === 'video' && props.file.relativePath.endsWith('.3gp')) {
		return false;
	}
	return true;
})

const isPanoramic = ref(false);
const ratio = ref(1);

function checkForPanoramic(e) {
	const image = e.target;
	const naturalRatio = image.naturalWidth / image.naturalHeight;

	// engage panoramic mode if the image exceeds the current screen aspect ratio
	const panoramicRatioLimit = window.innerWidth / window.innerHeight;
	const isWiderThanScreen = naturalRatio > 1 && naturalRatio > (panoramicRatioLimit * 1.25);
	const isTallerThanScreen = naturalRatio < 1 && naturalRatio < (panoramicRatioLimit * 0.75);
	isPanoramic.value = isWiderThanScreen || isTallerThanScreen;
	ratio.value = naturalRatio;
}

const videoPlayer = ref<InstanceType<typeof VideoPlayer> | null>(null);

defineExpose({
	isZooming,
	isPanoramic,
	ratio,
	videoPlayer,
});

const loadError = ref<any>(null);

</script>

<template>
	<div style="position: relative; width: 100%; height: 100%;">
		<div class="media-frame" ref="mediaFrame" style="width: 100%; height: 100%;" :class="{ error: loadError }">
			<!-- <div v-if="loadError" class="error-frame">
				error
			</div> -->
			<img
				v-if="file.fileType === 'photo' || showThumbnail"
				:src="hiResReady ? hiResUrl : lowResUrl" 
				:alt="isLoading ? '' : file.fileName" 
				style="width: 100%; height: 100%;"
				:style="{ objectFit }"
				:class="{ 'blurred': !hiResReady && loadSequence?.includes('blur') }"
				@error="(e) => loadError = e"
				@load="(e) => { checkForPanoramic(e); loadError = false; isLoading = false; }"
			/>
			<VideoPlayer
				v-else-if="file.fileType === 'video' || file.fileName.endsWith('.mp4')"
				ref="videoPlayer"
				:relativePath="file.relativePath"
				:hideControls="hideControls"
				:hideLoading="true"
				:autoplay="autoplay"
				style="width: 100%; height: 100%;"
				:style="{ objectFit, background: 'transparent' }"
				@loadedData="() => { loadError = false; isLoading = false; }"
				@error="(e) => loadError = e"
				:background="videoBackground"
				:seekerEl="videoSeeker"
			/>

			<div v-if="isLoading" class="loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
				<i class="pi pi-spin pi-spinner text-5xl" />
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.media-frame {
	position: relative;

	&.error {
		aspect-ratio: 1;
		overflow: hidden;
	}

	.error-frame {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
}
.blurred {
	filter: blur(20px);
	transition: filter 0.5s ease;
}
</style>
