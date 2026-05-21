<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useWatchProgressStore } from '@/stores/watchProgress.store';
import { useToast } from 'primevue/usetoast';
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick, onUnmounted } from 'vue';
import MediaTimer from './MediaTimer.vue';
import { encodeMediaPath, msToTimestamp, secToMs } from '@/utils/miscUtils';
import { useFullscreenStore } from '@/stores/fullscreenStore.store';
import { useScreenStore } from '@/stores/screen.store';
import { JobPinger } from '@/utils/JobPinger';
import VideoProgressBar from './VideoProgressBar.vue';
import type Message from 'primevue/message';
import VobSubCanvas from './VobSubCanvas.vue';
import PgsCanvas from './PgsCanvas.vue';
import { MseStream } from '@/utils/MseStream';
import VideoPlayer from './VideoPlayer.vue';
import Button from 'primevue/button';

const props = defineProps<{
}>();

const menu = ref();
const pauseMenu = ref(false);
const parentTitlePath = ref('');
const wrapperRef = ref<HTMLDivElement>();
const videoPlayerRef = ref<InstanceType<typeof VideoPlayer>>();

const activePage = ref<Array<any>>([]);

function buildMediaPath(subPath) {
	return parentTitlePath.value + subPath;
}

const activeBackgroundVideo = ref();
const backgroundVideoPath = computed(() => activeBackgroundVideo.value ? buildMediaPath(activeBackgroundVideo.value.path) : undefined);

async function waitForVideoEnd() {
	return new Promise((res, rej) => {
		videoPlayerRef.value?.videoRef?.addEventListener('ended', res);
	})
}

function loadMenu(newMenu, path) {
	menu.value = newMenu;
	parentTitlePath.value = path;
	enterPage(menu.value.pages[0]);
}

function resumeMenu() {
	pauseMenu.value = false;
	videoPlayerRef.value?.videoRef?.play();
}

async function enterPage(page) {
	if (page.entrySequence) {
		for (const step of page.entrySequence) {
			if (step.backgroundVideo) {
				await setBackgroundVideo(step.backgroundVideo);
				await waitForVideoEnd();
			}
		}
	}

	if (page.backgroundVideo) {
		await setBackgroundVideo(page.backgroundVideo);
	}

	if (page.displayDelay) {
		await new Promise(res => setTimeout(res, page.displayDelay));
	}

	activePage.value.push(page);
}

async function setBackgroundVideo(backgroundVideo) {
	activeBackgroundVideo.value = backgroundVideo;

	await nextTick();

	const videoEl = videoPlayerRef.value?.videoRef;

	if (!videoEl || !activeBackgroundVideo.value) {
		console.error("Video player is not mounted!")
		return;
	}

	// do loop setup once video can play
	videoEl.addEventListener('canplay', () => {
		if (activeBackgroundVideo.value.loopAt || activeBackgroundVideo.value.loopTo) {
			const loopAt = activeBackgroundVideo.value.loopAt || videoEl.duration;

			videoEl.addEventListener('timeupdate', () => {
				const time = videoEl.currentTime;
				if (time >= (loopAt - 0.3)) {
					videoEl.currentTime = activeBackgroundVideo.value.loopTo || 0;
				}
			})
		}

		videoEl.play();
	});
}

const emit = defineEmits<{ play: [ string ], close: [] }>();

function doAction(action) {
	console.log(action)
	if (!action) return;

	if (action.name === 'play-media') {
		pauseMenu.value = true;
		videoPlayerRef.value?.videoRef?.pause();
		emit('play', buildMediaPath(action.args.path));
	}
}

defineExpose({
	loadMenu,
	resumeMenu,
})

</script>

<template>
	<div class="wrapper tvNavigationFocusArea" ref="wrapperRef" v-if="menu">
			<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="$emit('close')" style="z-index: 1" />

			<VideoPlayer :key="backgroundVideoPath" ref="videoPlayerRef" :hideControls="true" :noEvents="true" :relativePath="backgroundVideoPath" />

			<div
				v-for="page of activePage"
				class="page-wrapper"
				:style="{
					aspectRatio: menu.aspectRatio,
					maxWidth: `calc(100vh * ${menu.aspectRatio})`,
				}"
			>
				<div
					v-for="frame of page.frames"
					class="frame-wrapper"
					:class="frame.layout"
					:style="{
						inset: frame.inset,
						fontFamily: frame.font?.family || 'inherit',
						fontWeight: frame.font?.weight || 'inherit',
					}"
				>
					<div v-for="element of frame.elements"
						class="frame-element"
						:tabindex="element.action ? 0 : undefined"
						@click="() => doAction(element.action)"
						:class="element.classes"
						:style="{
							...element.style,
						}"
					>
						{{ element.content }}
					</div>
				</div>
			</div>
	</div>
</template>

<style scoped lang="scss">
.wrapper {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	user-select: none;
	background: black;

	.page-wrapper {
		position: fixed;
		top: 50%;
		left: 50%;
		width: 100%;
		translate: -50% -50%;
		// border: 1px solid white;
		container-type: inline-size;
	}

	.frame-wrapper {
		position: absolute;
		// border: 1px solid white;
		overflow: auto;
		font-size: 1.5cqw;

		.frame-element {
			padding: .5em;

			&:hover, &:focus-within, &[tv-focus] {
				outline: 1px solid #fff;
			}
		}
	}

}
</style>
