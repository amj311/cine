<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { useScreenStore } from '@/stores/screen.store';
import { encodeMediaPath } from '@/utils/miscUtils';
import { useToast } from 'primevue/usetoast';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const toast = useToast();

const { chapters, ...props } = defineProps<{
	videoRef: HTMLVideoElement,
	mediaRelativePath: string,
	chapters?: Array<{
		title: string;
		start_s: number,
		end_s: number,
	}>;
}>();

const playingState = ref({
	paused: false,
	ended: false,
	currentTime: 0,
	percent: 0,
	duration_s: 0,
	buffered: null as null | TimeRanges,
	duration: 0,
});

function updatePlayingState() {
	if (!props.videoRef) {
		return;
	}

	playingState.value.duration = props.videoRef.duration;
	playingState.value.buffered = props.videoRef.buffered;
	playingState.value.currentTime = props.videoRef.currentTime;
	playingState.value.percent = props.videoRef.duration ? props.videoRef.currentTime * 100 / props.videoRef.duration : 0;
}

function loopUpdateState() {
	window.requestAnimationFrame(() => {
		updatePlayingState();
		loopUpdateState();
	})
}

onMounted(() => {
	loopUpdateState();
})

defineExpose({
	playingState,
})

function doSeek(time_s) {
	if (!props.videoRef) return;
	props.videoRef.currentTime = time_s;
}


/**************
 * CHAPTERS
 *************/

const segments = computed(() => {
	if (!chapters || chapters.length === 0) {
		return [{
			start_s: 0,
			end_s: playingState.value.duration_s,
		}]
	}
	else return chapters;
});

function getSegmentRelativeProgress(segment) {
	if (playingState.value.currentTime < segment.start_s) {
		return 0;
	}
	if (playingState.value.currentTime > segment.end_s) {
		return 100;
	}
	const progressIntoSegment = playingState.value.currentTime - segment.start_s;
	const segmentLength = segment.end_s - segment.start_s;
	return 100 * (progressIntoSegment / segmentLength);
}

const thumbSpots = computed(() => {
	const thumbInterval = Math.max(30, playingState.value.duration / 30);
	const spots = [] as any[];
	let spotTime = 0;
	while (spotTime < playingState.value.duration) {
		spots.push({
			start_s: spotTime,
			end_s: spotTime + thumbInterval,
			percent: spotTime / playingState.value.duration,
			endPercent: (spotTime + thumbInterval) / playingState.value.duration,
		});
		spotTime += thumbInterval;
	}
	return spots;
})

const activeThumb = computed(() => {
	return thumbSpots.value.find(t => t.endPercent >= mousePercent.value);
})

// EVENTS
const wrapperRef = ref<HTMLElement>();
const isDragging = ref(false);

const mousePercent = ref(0);

function getMouseEventTime(e: MouseEvent | TouchEvent) {
	if (!wrapperRef.value) return;
	const trackWidth = wrapperRef.value.getBoundingClientRect().width;
	const trackLeftOffset = wrapperRef.value.getBoundingClientRect().left;
	let clientX = ('clientX' in e) ? e.clientX : e.touches[0]!.clientX;
	const mousePercentIntoTrack = (clientX - trackLeftOffset) / trackWidth;
	mousePercent.value = mousePercentIntoTrack;
	return props.videoRef.duration * mousePercentIntoTrack;
}

function doMouseEventSeek(e: MouseEvent | TouchEvent) {
	doSeek(getMouseEventTime(e));
}

onMounted(() => {
	window.addEventListener('mousemove', trackMouseMove);
	window.addEventListener('touchmove', trackMouseMove);
	window.addEventListener('mouseup', handleDragEnd);
	window.addEventListener('touchend', handleDragEnd);

	if (wrapperRef.value) {
		wrapperRef.value
	}
})

onBeforeUnmount(() => {
	window.removeEventListener('mousemove', trackMouseMove);
	window.removeEventListener('touchmove', trackMouseMove);
	window.removeEventListener('mouseup', handleDragEnd);
	window.removeEventListener('touchend', handleDragEnd);
})

function handleMousedown(e: MouseEvent | TouchEvent) {
	isDragging.value = true;
	doMouseEventSeek(e);
}
function trackMouseMove(e: MouseEvent | TouchEvent) {
	e.stopPropagation();
	e.preventDefault();
	// videoRef.pause();
	getMouseEventTime(e);
	if (!isDragging.value) return;
	doMouseEventSeek(e);
}
function handleDragEnd() {
	isDragging.value = false;
}


</script>

<template>
	<div class="progress-wrapper flex h-full" :class="{ dragging: isDragging}" ref="wrapperRef" @click="doMouseEventSeek" @mousedown="handleMousedown" @touchstart="handleMousedown">
		<div
			v-for="segment of segments"
			class="segment"
			:style="{
				flexGrow: segment.end_s - segment.start_s,
				backgroundImage: `linear-gradient(to right, red ${getSegmentRelativeProgress(segment)}%, transparent ${getSegmentRelativeProgress(segment)}%)`
			}"
		>
		</div>
		<!-- Handle -->
		<div class="handle-wrapper absolute h-full top-0" style="width: calc(100% - var(--handle-width))">
			<div class="handle" :style="{ left: `${playingState.percent}%` }" />
		</div>
		<!-- Thumb -->
		<!-- <div class="thumb-area absolute h-full top-0" style="left: calc(var(--thumb-width) / 2); width: calc(100% - var(--thumb-width))"> -->
			<!-- {{ mousePercent }}
			{{ activeThumb?.percent }} -->
			<div class="thumb-wrapper absolute" v-if="activeThumb && !useScreenStore().isSkinnyScreen" :style="{ left: `min(max(calc(var(--thumb-width) / 2), ${activeThumb.percent * 100}%), calc(100% - (var(--thumb-width) / 2)))` }">
				<img :src="useApiStore().apiUrl + '/thumb/' + encodeMediaPath(mediaRelativePath) + '?width=200&seek=' + (activeThumb.start_s + 2)" />
			</div>
		<!-- </div> -->
	</div>
</template>

<style scoped lang="scss">
.progress-wrapper {
	--handle-width: 13px;
	--thumb-width: 8rem;
	position: relative;
	width: 100%;
	gap: 1px;
	padding: 3px 0;

	.segment {
		position: relative;
		height: 6px;
		border-radius: 2px;
		background: #555;
		pointer-events: none;
	}

	.handle-wrapper {
		pointer-events: none;
	}

	.handle {
		aspect-ratio: 1;
		width: var(--handle-width);
		background-color: red;
		box-shadow: 0 0 2px #000;
		border-radius: 50%;
		position: absolute;
		top: 50%;
		translate: 0% -50%;
		display: none;
	}

	.thumb-wrapper {
		width: var(--thumb-width);
		aspect-ratio: 3/2;
		background-color: var(--color-background-soft);
		box-shadow: 0 0 2px #000;
		border-radius: 5px;
		position: absolute;
		top: 0;
		translate: -50% -100%;
		display: none;
		padding: 3px;
		pointer-events: none;
		transition: 100ms left;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	&:hover, &.dragging {
		.handle, .thumb-wrapper {
			display: block;
		}
	}
}

</style>
