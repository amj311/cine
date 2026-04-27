<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { parseSubPacket, type SpuBitmap } from '@/utils/subParser';

const props = defineProps<{
	videoRef: HTMLVideoElement | undefined;
	path: string;
	trackIndex: number;
}>();

const idxFile = ref<any | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
	try {
		await useApiStore().api.post('/subtitles/vobsub/extract', {
			path: props.path,
			trackIndex: props.trackIndex,
		});
		await loadIndexAndStartLoop();
	} catch (e: any) {
		console.error('Failed to extract VobSub', e);
		error.value = e?.response?.data?.error ?? 'Extraction failed';
	} finally {
		loading.value = false;
	}
});

async function loadIndexAndStartLoop() {
	const { data } = await useApiStore().api.get('/subtitles/vobsub/index');
	idxFile.value = data;
	if (props.videoRef) startLoop(props.videoRef);
}

/*************
 * Frame loop
 ************/
const canvasRef = ref<HTMLCanvasElement | null>(null);
const lastEntryIndex = ref<number>(-1);
let frameCallbackHandle: number | null = null;
const bitmapCache = new Map<number, SpuBitmap | null>();
let currentStopMs: number | null = null;
let fetchAbortController: AbortController | null = null;

function clearCanvas() {
	const canvas = canvasRef.value;
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	ctx?.clearRect(0, 0, canvas.width, canvas.height);
}

function renderBitmap(bitmap: ReturnType<typeof parseSubPacket>) {
	if (!bitmap) { clearCanvas(); return; }
	const canvas = canvasRef.value;
	if (!canvas) return;

	// Size canvas to match the frame dimensions from the .idx file (fallback to video)
	const frameWidth = idxFile.value?.size?.width ?? props.videoRef?.videoWidth ?? bitmap.width;
	const frameHeight = idxFile.value?.size?.height ?? props.videoRef?.videoHeight ?? bitmap.height;
	canvas.width = frameWidth;
	canvas.height = frameHeight * 1.25;

	const ctx = canvas.getContext('2d')!;
	ctx.clearRect(0, 0, frameWidth, frameHeight);
	ctx.putImageData(bitmap.imageData, bitmap.x, bitmap.y);
}

function findEntryIndex(time_ms: number): number {
	const entries = idxFile.value?.tracks[0]?.entries;
	if (!entries?.length) return -1;
	let found = -1;
	for (let i = 0; i < entries.length; i++) {
		if (entries[i].timestamp_ms <= time_ms) found = i;
		else break;
	}
	return found;
}

async function loadBitmap(index: number, signal?: AbortSignal): Promise<SpuBitmap | null> {
	if (bitmapCache.has(index)) return bitmapCache.get(index) ?? null;

	const track = idxFile.value?.tracks[0];
	const entry = track?.entries[index];
	if (!entry) return null;

	const params: Record<string, number> = { filepos: entry.filepos };
	if (entry.size !== null) params.size = entry.size;

	const { data } = await useApiStore().api.get<ArrayBuffer>('/subtitles/vobsub/sub', {
		params,
		responseType: 'arraybuffer',
		signal,
	});

	const clut = idxFile.value?.palette ?? [];
	const bitmap = parseSubPacket(new Uint8Array(data), clut, entry.timestamp_ms);
	bitmapCache.set(index, bitmap);
	return bitmap;
}

async function fetchSubEntry(index: number) {
	if (index < 0) { clearCanvas(); currentStopMs = null; return; }

	// Cancel any in-flight fetch for a previous entry
	fetchAbortController?.abort();
	const controller = new AbortController();
	fetchAbortController = controller;

	try {
		const bitmap = await loadBitmap(index, controller.signal);

		// Guard against races: only render if this entry is still current
		if (index !== lastEntryIndex.value) return;

		renderBitmap(bitmap);
		currentStopMs = bitmap?.stopMs ?? null;

		// Preload next entry
		const entries = idxFile.value?.tracks[0]?.entries;
		if (entries && index + 1 < entries.length) {
			loadBitmap(index + 1);
		}

		// Evict entries before the current one
		for (const key of bitmapCache.keys()) {
			if (key < index) bitmapCache.delete(key);
		}
	} catch (e: any) {
		// Ignore cancellations triggered by a newer fetch
		if (e?.code === 'ERR_CANCELED' || e?.name === 'AbortError' || e?.name === 'CanceledError') return;
		throw e;
	}
}

function onVideoFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
	if (!props.videoRef) return;

	const time_ms = metadata.mediaTime * 1000;
	const entryIndex = findEntryIndex(time_ms);

	if (entryIndex !== lastEntryIndex.value) {
		lastEntryIndex.value = entryIndex;
		fetchSubEntry(entryIndex);
	} else if (currentStopMs !== null && time_ms >= currentStopMs) {
		clearCanvas();
		currentStopMs = null;
	}

	frameCallbackHandle = props.videoRef.requestVideoFrameCallback(onVideoFrame);
}

function startLoop(el: HTMLVideoElement) {
	frameCallbackHandle = el.requestVideoFrameCallback(onVideoFrame);
}

function stopLoop() {
	fetchAbortController?.abort();
	fetchAbortController = null;
	if (props.videoRef && frameCallbackHandle !== null) {
		props.videoRef.cancelVideoFrameCallback(frameCallbackHandle);
		frameCallbackHandle = null;
	}
}

watch(() => props.videoRef, (el) => {
	if (!idxFile.value) return; // not ready yet; loadIndexAndStartLoop will call startLoop
	stopLoop();
	if (el) startLoop(el);
});

onBeforeUnmount(() => {
	stopLoop();
});
</script>

<template>
	<div class="vobsub-wrapper">
		<div v-if="loading" class="vobsub-status">Loading subtitles…</div>
		<div v-else-if="error" class="vobsub-status vobsub-error">{{ error }}</div>
		<canvas v-else ref="canvasRef" class="vobsub-canvas" />
	</div>
</template>

<style scoped lang="scss">
.vobsub-canvas {
	position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    width: 100%;
    height: auto;
    pointer-events: none;
}
</style>
