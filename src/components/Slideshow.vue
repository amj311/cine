<script setup lang="ts">
import { reactive, computed, ref, watch, nextTick, defineComponent } from 'vue';
import Button from 'primevue/button';
import { useRouter } from 'vue-router';
import GalleryFileFrame, { type GalleryFile } from './GalleryFileFrame.vue';
import { focusAreaClass, useScreenStore } from '@/stores/screen.store';
import NavTrigger from './utils/NavTrigger/NavTrigger.vue';
import { useApiStore } from '@/stores/api.store';
import SlideshowFileFrame from './SlideshowFileFrame.vue';

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

const trigger = ref<InstanceType<typeof NavTrigger>>();
const slideshowEl = ref<HTMLDivElement>();

const hasFiles = computed(() => state.files.length > 0);
watch(() => trigger.value?.show, (newVal) => {
	if (newVal) {
		nextTick(setupListeners);
	} else {
		clearTimeout(state.playingTimer);
		nextTick(removeListeners);
	}
}, { immediate: true })


function open(files: Array<GalleryFile>, firstFile?: GalleryFile) {
	state.files = files;
	if (firstFile) {
		state.activeFileIdx = state.files.findIndex(p => p.relativePath === firstFile.relativePath);
	}
	trigger.value?.open();
}

function close() {
	clearTimeout(state.playingTimer);
	trigger.value?.close();
	props.onClose?.call(null);
}

defineExpose({open, close});

const activeFile = computed(() => state.files[state.activeFileIdx]);
const isPlaying = computed(() => state.playingTimer !== 0);
const nextFile = computed(() => state.files[(state.activeFileIdx + 1) % state.files.length]);
const prevFile = computed(() => state.files[(state.activeFileIdx - 1 + state.files.length) % state.files.length]);

const initialScroll = window.scrollY;
const activeSlideFrame = ref<InstanceType<typeof SlideshowFileFrame> | null>(null);
const activeFrame = computed(() => activeSlideFrame.value?.galleryFrame);

function setupListeners() {
	updateSwipeDelta(0);
	window.addEventListener('keydown', handleKeydown);
	slideshowEl.value?.addEventListener('touchstart', handleTouchStart, { passive: true });
	slideshowEl.value?.addEventListener('touchmove', handleTouchMove, { passive: true });
	slideshowEl.value?.addEventListener('touchend', handleTouchEnd, { passive: true });
	window.addEventListener('scroll', preventScroll, { passive: true });
}
function removeListeners() {
	window.removeEventListener('keydown', handleKeydown);
	slideshowEl.value?.removeEventListener('touchstart', handleTouchStart);
	slideshowEl.value?.removeEventListener('touchmove', handleTouchMove);
	slideshowEl.value?.removeEventListener('touchend', handleTouchEnd);
	window.removeEventListener('scroll', preventScroll);
}

const animationTime = 300;
let lastUiSwapTime = 0;

function uiSwap(action) {
	console.log(verticalMode.value)
	const now = Date.now();
	const doAnimate = now - lastUiSwapTime > animationTime;
	lastUiSwapTime = now;
	if (panTrigger.value?.show) {
		panTrigger.value?.close();
	}
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
	swipeStart = 0;
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

const verticalMode = computed(() => useScreenStore().isSkinnyScreen && useScreenStore().detectedTouch);
const clientTouchProp = computed(() => verticalMode.value ? 'clientY' : 'clientX');
let swipeStart = 0;

function updateSwipeDelta(val) {
	document.documentElement.style.setProperty('--swipe-delta', val + 'px');
}

function handleTouchStart(e) {
	e.stopPropagation();
	e.preventDefault();
	swipeStart = e.touches[0][clientTouchProp.value];
}
function handleTouchMove(e) {
	e.stopPropagation();
	e.preventDefault();
	if (activeFrame.value?.isZooming) {
		return;
	}
	updateSwipeDelta(e.touches[0][clientTouchProp.value] - swipeStart);
}
function handleTouchEnd(e) {
	e.stopPropagation();
	e.preventDefault();
	if (activeFrame.value?.isZooming) {
		updateSwipeDelta(0);
		return;
	}
	const swipeEnd = e.changedTouches[0][clientTouchProp.value];
	if (swipeStart - swipeEnd > 100) {
		uiSwap(goToNext);
	} else if (swipeEnd - swipeStart > 100) {
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


const panTrigger = ref<InstanceType<typeof NavTrigger>>();
function togglePanoramic() {
	if (panTrigger.value?.show) {
		panTrigger.value?.close();
	}
	else {
		panTrigger.value?.open();
	}
}

</script>


<template>
	<NavTrigger ref="trigger" triggerKey="slideshow">
		<template #default="{ show }">
			<div id="Slideshow" ref="slideshowEl" v-if="show && hasFiles" :class="focusAreaClass">
				<div class="file-frame" :class="{ [state.animationClass]: true, 'vertical': verticalMode }">
					<div class="prev frame">
						<SlideshowFileFrame :showArrows="!verticalMode" :onPrev="() => uiSwap(goToPrev)" :onNext="() => uiSwap(goToNext)" :onClose="close" :file="prevFile" />
					</div>
					<div class="active frame">
						<SlideshowFileFrame :showArrows="!verticalMode" :onPrev="() => uiSwap(goToPrev)" :onNext="() => uiSwap(goToNext)" ref="activeSlideFrame" :onClose="close" :file="activeFile" active>
							<template #actions>
								<Button :variant="panTrigger?.show ? '' : 'text'" severity="contrast" v-if="activeFrame?.isPanoramic" @click="togglePanoramic"><i class="material-symbols-outlined">vrpano</i></Button>
							</template>
						</SlideshowFileFrame>
					</div>
					<div class="next frame">
						<SlideshowFileFrame :showArrows="!verticalMode" :onPrev="() => uiSwap(goToPrev)" :onNext="() => uiSwap(goToNext)" :onClose="close" :file="nextFile" />
					</div>
				</div>
				
				<!-- <div class="top-bar flex justify-content-start align-items-center gap-2 flex-wrap">
					<Button text severity="contrast" @click="close" icon="pi pi-times" />
					<div>{{ activeFile.fileName }}</div>
					<div class="flex-grow-1 flex justify-content-end align-items-center gap-2">
						<div style="flex-grow: 1"></div>
						<small v-if="activeFile.takenAt">&nbsp;&nbsp;<i class="pi pi-calendar" /> {{ new Date(activeFile.takenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</small>
						<small v-if="activeFileFolders.length">&nbsp;&nbsp;<i class="pi pi-folder-open" /> {{ activeFileFolders.join(' / ') }}</small>
					</div>
				</div> -->
				
			</div>
		</template>
	</NavTrigger>


	<!-- Panoramic frame -->
	<NavTrigger ref="panTrigger">
		<template #default="{ show }">
			<div v-if="show" class="pan-frame">
				<div class="loading"><i class="pi pi-spin pi-spinner text-5xl" /></div>
				<img :src="useApiStore().resolve('media/' + activeFile.relativePath)" :style="{ width: activeFrame!.ratio < 1 ? '99%' : '', height: activeFrame!.ratio > 1 ? '99%' : '' }" />
				<div class="closer"><Button text severity="contrast" @click="panTrigger?.close" icon="pi pi-times" /></div>
			</div>
		</template>
	</NavTrigger>
</template>

<style lang="scss" scoped>
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
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;
	z-index: 20;

	.file-frame {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;

		.frame {
			position: absolute;
			width: 100%;
			height: 100%;
			overflow: hidden;

			.blur-bg {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background-size: cover;
				background-position: center;
				filter: blur(25px);
				opacity: .7;
				z-index: -1;
			}
		}

		&:not(.vertical) {
			.prev {
				transform: translateX(calc(-100vw + var(--swipe-delta)));
			}

			.next {
				transform: translateX(calc(100vw + var(--swipe-delta)));
			}

			.active {
				transform: translateX(var(--swipe-delta));
				z-index: 1;
			}

			&.slideNext {
				.next {
					transform: translateX(0);
				}

				.active {
					transform: translateX(-100vw);
				}
			}

			&.slidePrev {
				.prev {
					transform: translateX(0);
				}

				.active {
					transform: translateX(100vw);
				}
			}
		}

		&.vertical {
			.prev {
				transform: translateY(calc(-100vh + var(--swipe-delta)));
			}

			.next {
				transform: translateY(calc(100vh + var(--swipe-delta)));
			}

			.active {
				transform: translateY(var(--swipe-delta));
				z-index: 1;
			}

			&.slideNext {
				.next {
					transform: translateY(0);
				}

				.active {
					transform: translateY(-100vh);
				}
			}

			&.slidePrev {
				.prev {
					transform: translateY(0);
				}

				.active {
					transform: translateY(100vh);
				}
			}
		}


		&.slideNext {
			.next, .active {
				transition: 300ms ease;
			}
		}

		&.slidePrev {
			.prev, .active {
				transition: 300ms ease;
			}
		}
	}
}

.pan-frame {
    position: fixed;
    top: 0rem;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: auto;
    background-color: var(--color-background);
    z-index: 21;
	
	img {
		z-index: 1;
		position: relative;
	}

	.loading {
		position: fixed;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		z-index: 0;
	}

	.closer {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 22;
	}
}
</style>