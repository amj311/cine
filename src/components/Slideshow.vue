<script setup lang="ts">
import { reactive, computed, ref, watch, nextTick } from 'vue';
import Button from 'primevue/button';
import { useRouter } from 'vue-router';
import GalleryFileFrame, { type GalleryFile } from './GalleryFileFrame.vue';

const router = useRouter();

const props = defineProps<{
	onClose?: () => void
}>()

const state = reactive({
	files: [] as GalleryFile[],
	activeFileIdx: 0,
	playingTimer: 0,
	animationClass: '',
});

const showSlideshow = computed(() => router.currentRoute.value.query.slideshow === 'true' && state.files.length > 0);
watch(showSlideshow, () => {
	if (showSlideshow.value) {
		setupListeners();
	} else {
		clearTimeout(state.playingTimer);
		removeListeners();
	}
})


function open(files: Array<GalleryFile>, firstFile?: GalleryFile) {
	state.files = files;
	if (firstFile) {
		state.activeFileIdx = state.files.findIndex(p => p.relativePath === firstFile.relativePath);
	}
	router.push({ query: { ...router.currentRoute.value.query, slideshow: 'true' } });
	nextTick(() => {
		setupListeners();
	});
}

function close() {
	clearTimeout(state.playingTimer);
	removeListeners();
	router.back();
	props.onClose?.call(null)
}

defineExpose({open, close});

const activeFile = computed(() => state.files[state.activeFileIdx]);
const isPlaying = computed(() => state.playingTimer !== 0);
const nextFile = computed(() => state.files[(state.activeFileIdx + 1) % state.files.length]);
const prevFile = computed(() => state.files[(state.activeFileIdx - 1 + state.files.length) % state.files.length]);

const initialScroll = window.scrollY;
const activeFrame = ref<InstanceType<typeof GalleryFileFrame> | null>(null);

function setupListeners() {
	window.addEventListener('keydown', handleKeydown);
	window.addEventListener('touchstart', handleTouchStart);
	window.addEventListener('touchmove', handleTouchMove);
	window.addEventListener('touchend', handleTouchEnd);
	window.addEventListener('scroll', preventScroll);
}
function removeListeners() {
	window.removeEventListener('keydown', handleKeydown);
	window.removeEventListener('touchstart', handleTouchStart);
	window.removeEventListener('touchmove', handleTouchMove);
	window.removeEventListener('touchend', handleTouchEnd);
	window.removeEventListener('scroll', preventScroll);
}


const animationTime = 500;
let lastUiSwapTime = 0;

function uiSwap(action) {
	const now = Date.now();
	const doAnimate = now - lastUiSwapTime > animationTime;
	lastUiSwapTime = now;
	action(doAnimate);
}

async function goToNext(animate = true) {
	if (animate) {
		state.animationClass = 'slideNext';
		await new Promise(r => setTimeout(r, animationTime));
	}
	state.activeFileIdx = (state.activeFileIdx + 1) % state.files.length;
	resetAfterSwap();
}

async function goToPrev(animate = true) {
	if (animate) {
		state.animationClass = 'slidePrev';
		await new Promise(r => setTimeout(r, animationTime));
	}
	state.activeFileIdx = (state.activeFileIdx - 1 + state.files.length) % state.files.length;
	resetAfterSwap();
}

function resetAfterSwap() {
	state.animationClass = '';
	// start and sto to reset time
	if (isPlaying.value) {
		stop();
		play();
	}
	updateSwipeDelta(0);
	swipeStartX = 0;
}

function play() {
	// This can be a timeout instead of an interval because goToNext calls play again
	state.playingTimer = setTimeout(goToNext, 5000) as any;
}
function stop() {
	clearTimeout(state.playingTimer);
	state.playingTimer = 0;
}

function handleKeydown(e) {
	if (e.key === 'ArrowRight') {
		e.preventDefault();
		uiSwap(goToNext);
	} else if (e.key === 'ArrowLeft') {
		e.preventDefault();
		uiSwap(goToPrev);
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		uiSwap(goToPrev);
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		uiSwap(goToNext);
	} else if (e.key === 'Escape') {
		e.preventDefault();
		close();
	} else if (e.key === ' ' && !isPlaying.value) {
		e.preventDefault();
		play();
	} else if (e.key === ' ' && isPlaying.value) {
		e.preventDefault();
		stop();
	}
}

let swipeStartX = 0;

function updateSwipeDelta(val) {
	document.documentElement.style.setProperty('--swipe-delta', val + 'px');
}

function handleTouchStart(e) {
	swipeStartX = e.touches[0].clientX;
}
function handleTouchMove(e) {
	if (activeFrame.value?.isZooming) {
		return;
	}
	updateSwipeDelta(e.touches[0].clientX - swipeStartX);
}
function handleTouchEnd(e) {
	if (activeFrame.value?.isZooming) {
		updateSwipeDelta(0);
		return;
	}
	const swipeEndX = e.changedTouches[0].clientX;
	if (swipeStartX - swipeEndX > 100) {
		uiSwap(goToNext);
	} else if (swipeEndX - swipeStartX > 100) {
		uiSwap(goToPrev);
	} else {
		updateSwipeDelta(0);
	}
}

function preventScroll(e) {
	window.scroll({
		top: initialScroll,
		left: 0,
		behavior: 'instant',
	});
}


const activeFileFolders = computed(() => activeFile.value.relativePath.split('/').slice(1, -1));


</script>


<template>
	<div id="Slideshow" v-if="showSlideshow">
		<div id="topBar" class="flex justify-content-start align-items-center gap-2 flex-wrap">
			<Button text severity="contrast" @click="close" icon="pi pi-times" />
			<div>{{ activeFile.fileName }}</div>
			<div class="flex-grow-1 flex justify-content-end align-items-center gap-2">
				<div style="flex-grow: 1"></div>
				<small v-if="activeFile.takenAt">&nbsp;&nbsp;<i class="pi pi-calendar" /> {{ new Date(activeFile.takenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</small>
				<small v-if="activeFileFolders.length">&nbsp;&nbsp;<i class="pi pi-folder-open" /> {{ activeFileFolders.join(' / ') }}</small>
			</div>
		</div>
		<div :class="{ 'file-frame': true, [state.animationClass]: true }">
			<div class="prev">
				<GalleryFileFrame :key="prevFile.relativePath" :file="prevFile" :size="'small'" :object-fit="'contain'" />
			</div>
			<div class="active" >
				<GalleryFileFrame ref="activeFrame" :key="activeFile.relativePath" :file="activeFile" :size="'large'" :object-fit="'contain'" :autoplay="true" :sequential-load="true" :zoom="true" />
			</div>
			<div class="next">
				<GalleryFileFrame :key="nextFile.relativePath" :file="nextFile" :size="'small'" :object-fit="'contain'" />
			</div>
		</div>
		<div id="bottomBar">
			<Button text severity="contrast" @click="() => uiSwap(goToPrev)" icon="pi pi-chevron-left" />
			<Button text severity="contrast" v-if="!isPlaying" @click="play" icon="pi pi-play" />
			<Button text severity="contrast" v-if="isPlaying" @click="stop" icon="pi pi-pause" />
			<Button text severity="contrast" @click="() => uiSwap(goToNext)" icon="pi pi-chevron-right" />
		</div>

		<div style="display: none">

		</div>
	</div>
</template>

<style lang="scss">
:root {
	--swipe-delta: 0px;
}

#Slideshow {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: var(--color-background);
	backdrop-filter: blur(5px);
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;
	z-index: 20;


	#topBar {
		width: 100%;
		padding: .5em;
	}

	#bottomBar {
		display: flex;
		justify-content: center;
		padding: .5em;
		gap: 1em;
	}

	.file-frame {
		position: relative;
		height: calc(100% - 110px); // room for top and bottom bars
		width: 100%;

		> div {
			position: absolute;
			width: 100%;
			height: 100%;
		}

		.prev {
			transform: translateX(calc(-100vw + var(--swipe-delta)));
		}

		.next {
			transform: translateX(calc(100vw + var(--swipe-delta)));
		}

		.active {
			transform: translateX(var(--swipe-delta));
		}

		&.slideNext {
			.next {
				transform: translateX(0);
				transition: 500ms ease;
			}

			.active {
				transform: translateX(-100vw);
				opacity: 0;
				transition: 500ms ease;
			}
		}

		&.slidePrev {
			.prev {
				transform: translateX(0);
				transition: 500ms ease;
			}

			.active {
				transform: translateX(100vw);
				opacity: 0;
				transition: 500ms ease;
			}
		}
	}

}
</style>