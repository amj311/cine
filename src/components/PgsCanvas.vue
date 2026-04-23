<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PgsDecoder, type PgsBitmap } from '@/utils/pgsParser';

const props = defineProps<{
	videoRef: HTMLVideoElement | undefined;
	path: string;
	trackIndex: number;
}>();

const loading = ref(true);
const error   = ref<string | null>(null);

// ---------------------------------------------------------------------------
// Setup: extract + index
// ---------------------------------------------------------------------------

/** Sorted list of display-set index entries from the server. */
interface PgsEntry { pts_ms: number; offset: number; size: number; isEmpty: boolean; }
const index = ref<PgsEntry[]>([]);

onMounted(async () => {
	try {
		await useApiStore().api.post('/subtitles/pgs/extract', {
			path: props.path,
			trackIndex: props.trackIndex,
		});
		const { data } = await useApiStore().api.get<PgsEntry[]>('/subtitles/pgs/index');
		index.value = data;
		if (props.videoRef) startLoop(props.videoRef);
	} catch (e: any) {
		console.error('Failed to extract PGS subtitles', e);
		error.value = e?.response?.data?.error ?? 'Extraction failed';
	} finally {
		loading.value = false;
	}
});

// ---------------------------------------------------------------------------
// Playback loop
// ---------------------------------------------------------------------------

const canvasRef = ref<HTMLCanvasElement | null>(null);
const lastEntryIndex = ref<number>(-2); // -2 = uninitialized sentinel
let frameCallbackHandle: number | null = null;

/**
 * Stateful decoder — persists epoch-level palette and object caches
 * across sequential display-set fetches.
 */
const decoder = new PgsDecoder();

/**
 * Cache: entry index → rendered PgsBitmap | null.
 * Null indicates an empty / clear-screen display set.
 */
const bitmapCache = new Map<number, PgsBitmap | null>();

/** Index of the last entry the decoder has processed (for ordering). */
let lastDecodedIndex = -1;

function clearCanvas() {
	const canvas = canvasRef.value;
	if (!canvas) return;
	canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function renderBitmap(bitmap: PgsBitmap | null) {
	if (!bitmap || bitmap.isEmpty || !bitmap.imageData) {
		clearCanvas();
		return;
	}

	const canvas = canvasRef.value;
	if (!canvas) return;

	// Size the canvas to the video frame dimensions declared in the PCS,
	// with a small vertical extension to keep the canvas CSS sizing consistent
	// with VobSubCanvas (height × 1.25 so CSS height:auto gives the right ratio).
	canvas.width  = bitmap.videoWidth;
	canvas.height = bitmap.videoHeight;

	const ctx = canvas.getContext('2d')!;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.putImageData(bitmap.imageData, bitmap.x, bitmap.y);
}

/** Binary search: largest entry index whose pts_ms ≤ time_ms, or -1. */
function findEntryIndex(time_ms: number): number {
	const entries = index.value;
	if (!entries.length) return -1;

	let lo = 0, hi = entries.length - 1, found = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (entries[mid].pts_ms <= time_ms) { found = mid; lo = mid + 1; }
		else hi = mid - 1;
	}
	return found;
}

async function loadBitmap(entryIdx: number): Promise<PgsBitmap | null> {
	if (bitmapCache.has(entryIdx)) return bitmapCache.get(entryIdx) ?? null;

	const entry = index.value[entryIdx];
	if (!entry) return null;

	// If the decoder has moved past this entry (e.g. user seeked backward),
	// reset it so it starts fresh from this entry.
	if (entryIdx < lastDecodedIndex) {
		decoder.reset();
		lastDecodedIndex = -1;
	}

	// For the decoder to be correct we must have processed all preceding
	// entries in order.  In normal forward playback the preloader ensures
	// this; after a reset we accept the small inaccuracy for the first frame.
	const { data } = await useApiStore().api.get<ArrayBuffer>('/subtitles/pgs/displayset', {
		params: { offset: entry.offset, size: entry.size },
		responseType: 'arraybuffer',
	});

	const bitmap = decoder.parseDisplaySet(new Uint8Array(data), entry.pts_ms);
	lastDecodedIndex = entryIdx;
	bitmapCache.set(entryIdx, bitmap);
	return bitmap;
}

async function fetchAndRender(entryIdx: number) {
	if (entryIdx < 0) { clearCanvas(); return; }

	const bitmap = await loadBitmap(entryIdx);

	// Guard against races: only render if this entry is still current
	if (entryIdx !== lastEntryIndex.value) return;

	renderBitmap(bitmap);

	// Preload the next entry so it is ready without a visible delay
	if (entryIdx + 1 < index.value.length) {
		loadBitmap(entryIdx + 1);
	}

	// Evict cache entries that are far behind current playback
	for (const key of bitmapCache.keys()) {
		if (key < entryIdx - 2) bitmapCache.delete(key);
	}
}

function onVideoFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
	if (!props.videoRef) return;

	const time_ms   = metadata.mediaTime * 1000;
	const entryIdx  = findEntryIndex(time_ms);

	if (entryIdx !== lastEntryIndex.value) {
		lastEntryIndex.value = entryIdx;
		fetchAndRender(entryIdx);
	}

	frameCallbackHandle = props.videoRef.requestVideoFrameCallback(onVideoFrame);
}

function startLoop(el: HTMLVideoElement) {
	frameCallbackHandle = el.requestVideoFrameCallback(onVideoFrame);
}

function stopLoop() {
	if (props.videoRef && frameCallbackHandle !== null) {
		props.videoRef.cancelVideoFrameCallback(frameCallbackHandle);
		frameCallbackHandle = null;
	}
}

watch(() => props.videoRef, (el) => {
	if (!index.value.length) return; // not ready yet; onMounted will call startLoop
	stopLoop();
	if (el) startLoop(el);
});

onBeforeUnmount(() => {
	stopLoop();
});
</script>

<template>
	<div class="pgs-wrapper">
		<div v-if="loading" class="pgs-status">Loading subtitles…</div>
		<div v-else-if="error" class="pgs-status pgs-error">{{ error }}</div>
		<canvas v-else ref="canvasRef" class="pgs-canvas" />
	</div>
</template>

<style scoped lang="scss">
.pgs-canvas {
	position: absolute;
	top: 50%;
	left: 50%;
	translate: -50% -50%;
	width: 100%;
	height: auto;
	pointer-events: none;
}
</style>
