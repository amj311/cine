<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { ref, computed, onMounted, nextTick, type Ref } from 'vue';
import { encodeMediaPath, wait } from '@/utils/miscUtils';
import VideoPlayer from './VideoPlayer.vue';
import Button from 'primevue/button';

const props = defineProps<{
}>();

const TestMenu = undefined;

const menu = ref();
const pauseMenu = ref(false);
const parentTitlePath = ref('');
// const videoPlayerRef = ref<InstanceType<typeof VideoPlayer>>();
const preloaderRef = ref<HTMLVideoElement>();
const showStartButton = ref(false);


onMounted(() => {
	setTimeout(() => {
		// autoplay may not start. give user option to kickstart
		if (activeVideoPlayer.value?.videoRef?.paused) {
			showStartButton.value = true;
		}
	}, 500);
})

const activePage = ref<any>([]);
const activeFrames = ref<Array<string>>([]);

function buildMediaPath(subPath) {
	return parentTitlePath.value + subPath;
}

const activeBackgroundVideo = ref();
const backgroundVideoPath = computed(() => activeBackgroundVideo.value ? buildMediaPath(activeBackgroundVideo.value.path) : undefined);
const topVideoPath = ref('');
const preloadPath = ref('');
const loopingBackgroundVideo = ref(false);
const hideElements = ref(true);



// const queuedVideos = computed(() => {
// 	// gather all video urls
// 	const paths = new Set<string>();

// 	const page = activePage.value;
// 	if (!page) return paths;

// 	// for (const page of menu.value?.pages || []) {
// 		for (const seq of (page.entrySequence || []).concat(page.exitSequence || [])) {
// 			if (seq.backgroundVideo) {
// 				paths.add(seq.backgroundVideo.path);
// 			}
// 		}

// 		if (page.backgroundVideo) {
// 			paths.add(page.backgroundVideo.path);
// 		}

// 		for (const frame of page.frames || []) {
// 			for (const element of frame.elements || []) {
// 				const path = element.action?.args?.path || element.action?.args?.video?.path;
// 				if (path) {
// 					paths.add(path);
// 				}
// 			}
// 		}
// 	// }

// 	console.log("new queued videos", paths)
// 	return paths;
// });

// Queue of videos: previously loaded and next during transition. ActiveBackgroundVideo determines which ref to look at
const queuedVideos = ref<Set<string>>(new Set());
const videoPlayerRefs = ref(new Map<string, InstanceType<typeof VideoPlayer>>());

const activeVideoPlayer = computed(() => {
	return videoPlayerRefs.value.get(activeBackgroundVideo.value?.path || '');
})

function listenWithCleanup(event: keyof HTMLVideoElementEventMap, handler) {
	let listener;
	const cleanup = () => {
		activeVideoPlayer.value?.videoRef?.removeEventListener(event, listener);
	}
	listener = () => {
		handler(cleanup);
	};
	activeVideoPlayer.value?.videoRef?.addEventListener(event, listener);
}

async function waitForVideoEnd() {
	return new Promise<void>((res, rej) => {
		listenWithCleanup('ended', (cleanup) => { cleanup(); res(); })
	})
}

async function waitForVideoTime(time_sec: number) {
	return new Promise<void>((res, rej) => {
		listenWithCleanup('timeupdate', (cleanup) => {
			if (activeVideoPlayer.value!.videoRef!.currentTime >= time_sec) {
				cleanup();
				res();
			}
		})
	})
}

async function loadMenu(newMenu, path) {
	menu.value = TestMenu || newMenu;
	parentTitlePath.value = path;
	if (menu.value.entrySequence) {
		await playSequence(menu.value.entrySequence);
	}
	await enterPage(menu.value.pages[0].id);
}

function resumeMenu() {
	pauseMenu.value = false;
	activeVideoPlayer.value?.videoRef?.play();
}

async function enterPage(pageId: string, skipEntry = false) {
	const page = menu.value?.pages?.find(p => p.id === pageId);
	if (!page) return;

	const previousActivePage = { ...activePage.value };

	hideElements.value = true;
		
	// trigger background loading for all videos on page during entry
	// preloadPageVideos(page).catch(console.error);

	if (previousActivePage?.exitSequence) {
		await playSequence(previousActivePage.exitSequence);
	}

	activePage.value = page;


	if (page.entrySequence && !skipEntry) {
		await playSequence(page.entrySequence);
	}

	if (page.backgroundVideo) {
		await setBackgroundVideo(page.backgroundVideo);
		await nextTick();
	}

	if (page.displayDelay) {
		await waitForVideoTime(page.displayDelay / 1000);
	}

	hideElements.value = false;

	if (page.frames?.length && !page.frames.some(f => activeFrames.value?.some(frameId => frameId === f.id))) {
		activeFrames.value = [page.frames[0].id];
	}
}

async function playSequence(sequence) {
	for (const step of sequence) {
		if (step.backgroundVideo) {
			await setBackgroundVideo(step.backgroundVideo);
			if (step.backgroundVideo.end) {
				await waitForVideoTime(step.backgroundVideo.end);
			}
			else {
				await waitForVideoEnd();
			}
		}
	}
}

async function preloadPageVideos(page) {
	// gather all video urls
	const paths: string[] = [];

	for (const seq of (page.entrySequence || []).concat(page.exitSequence || [])) {
		if (seq.backgroundVideo) {
			paths.push(seq.backgroundVideo.path);
		}
	}

	if (page.backgroundVideo) {
		paths.push(page.backgroundVideo.path);
	}

	for (const frame of page.frames || []) {
		for (const element of frame.elements || []) {
			const path = element.action?.args?.path || element.action?.args?.video?.path;
			if (path) {
				paths.push(path);
			}
		}
	}

	for (const path of paths) {
		preloadPath.value = buildMediaPath(path);
		await nextTick();
		const videoRef = preloaderRef.value;
		if (!videoRef) {
			console.error('Could not preload video', path);
			continue;
		}
		videoRef.load();
		await new Promise(res => {
			videoRef?.addEventListener('canplay', res);
			videoRef?.addEventListener('error', res);
		})
	}
}

async function setBackgroundVideo(backgroundVideo) {
	queuedVideos.value.add(backgroundVideo.path);

	let previousBackgroundVideoPath = activeBackgroundVideo.value?.path;
	let previousBackgroundVideoEl = activeVideoPlayer.value?.videoRef;

	await nextTick();

	const videoEl = videoPlayerRefs.value.get(backgroundVideo.path)?.videoRef;

	if (!videoEl) {
		console.error("Video player is not mounted!")
		return;
	}

	videoEl.currentTime = backgroundVideo.start || 0;
	loopingBackgroundVideo.value = true;
	videoEl.addEventListener('timeupdate', loopHandler);
	videoEl.play();
	
	activeBackgroundVideo.value = backgroundVideo;

	if (previousBackgroundVideoPath !== activeBackgroundVideo.value?.path) {
		previousBackgroundVideoEl?.pause();
		await new Promise<void>((resolve, reject) => {
			videoEl.addEventListener('canplay', () => {
				resolve();
			});
			videoEl.addEventListener('error', () => {
				reject();
			});
		}).catch((error) => {
			console.error('Error occurred while waiting for video to load:', error);
		});
		// queuedVideos.value.delete(previousBackgroundVideoPath);
	}

	topVideoPath.value = activeBackgroundVideo.value.path;
}

function loopHandler() {
	const videoEl = activeVideoPlayer.value?.videoRef;

	if (videoEl && (activeBackgroundVideo.value.loopAt || activeBackgroundVideo.value.loopTo)) {
		const loopAt = activeBackgroundVideo.value.loopAt || videoEl.duration;

		const time = videoEl.currentTime;
		if (time >= (loopAt - 0.3) && loopingBackgroundVideo.value === true) {
			videoEl.currentTime = activeBackgroundVideo.value.loopTo || 0;
		}
	}
}

async function shiftBackgroundVideo(shiftVideoConfig) {
	if (!activeVideoPlayer.value?.videoRef) return;

	// save and hide page elements
	hideElements.value = true;

	// save current video
	const previousVideo = {...activeBackgroundVideo.value};
	
	const isNewPath = shiftVideoConfig.path && shiftVideoConfig.path !== previousVideo.path;
	if (isNewPath) {
		activeBackgroundVideo.value!.path = shiftVideoConfig.path;
		await nextTick();
	}

	loopingBackgroundVideo.value = false;
	activeVideoPlayer.value!.videoRef!.currentTime = shiftVideoConfig.start || 0;
	activeVideoPlayer.value!.videoRef!.play();
	console.log(activeVideoPlayer.value?.videoRef)
	console.log("waiting for video end", shiftVideoConfig.end)
	await waitForVideoTime(shiftVideoConfig.end);
	console.log("done")
	loopingBackgroundVideo.value = true;

	const returnVideo = {
		...previousVideo,
		start: shiftVideoConfig.returnToLoop ? previousVideo.loopTo : previousVideo.start,
	};

	console.log("returning to video", returnVideo)

	await setBackgroundVideo(returnVideo);
	hideElements.value = false;
}

const emit = defineEmits<{ play: [ string ], close: [] }>();

function doAction(action) {
	if (!action) return;

	if (action.name === 'play-media') {
		pauseMenu.value = true;
		activeVideoPlayer.value?.videoRef?.pause();
		emit('play', buildMediaPath(action.args.path));
	}
	else if (action.name === 'add-active-frame') {
		const frameId = action.args.frameId;
		if (frameId && !activeFrames.value.includes(frameId)) {
			activeFrames.value.push(frameId);
			}
	}
	else if (action.name === 'remove-active-frame') {
		const frameId = action.args.frameId;
		activeFrames.value = activeFrames.value.filter(id => id !== frameId);
	}
	else if (action.name === 'replace-active-frame') {
		const frameId = action.args.frameId;
		activeFrames.value = frameId ? [frameId] : [];
	}
	else if (action.name === 'enter-page') {
		const pageId = action.args.pageId;
		enterPage(pageId, action.args.skipEntry);
	}
	else if (action.name === 'shift-background-video') {
		shiftBackgroundVideo(action.args.video);
	}
}

defineExpose({
	loadMenu,
	resumeMenu,
})

</script>

<template>
	<div class="wrapper tvNavigationFocusArea" ref="wrapperRef" v-if="menu">
		<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="$emit('close')" class="fixed top-0 left-0 text-xl" style="z-index: 2" />

		<!-- <video ref="preloaderRef" class="video-player" :controls="false" :src="useApiStore().getStreamUrl(preloadPath)" preload="true" crossorigin="use-credentials" allow></video> -->
		<div v-for="path in queuedVideos" class="absolute-full queued-video" :class="{ 'top': path === topVideoPath ? 1 : 0 }" ><VideoPlayer :key="path" :ref="(ref) => videoPlayerRefs.set(path, ref as InstanceType<typeof VideoPlayer>)" :hideControls="true" :hideLoading="true" :inactive="true" :relativePath="buildMediaPath(path)" /></div>
		<!-- <VideoPlayer :key="backgroundVideoPath" ref="videoPlayerRef" :hideControls="true" :hideLoading="true" :noEvents="true" :relativePath="backgroundVideoPath" /> -->

		<div class="menu-wrapper"
			:style="{
				aspectRatio: menu.aspectRatio,
				maxWidth: `calc(100vh * ${menu.aspectRatio})`,
				...(menu.style || {}),
			}"
		>
			<div
				v-if="activePage && !hideElements"
				class="page-wrapper"
				:style="{
					fontSize: `${activePage.fontSize || menu.fontSize || 1.5}cqw`,
				}"
			>
				<template v-for="frame of activePage.frames">
					<div v-if="activeFrames.includes(frame.id)"
						class="frame-wrapper"
						:class="`${frame.layout || ''} ${frame.classes || ''}`"
						:style="{
							inset: frame.inset || '0%',
							fontFamily: frame.font?.family || 'inherit',
							fontWeight: frame.font?.weight || 'inherit',
							...(frame.style || {}),
						}"
					>
						<div v-for="element of frame.elements"
							class="frame-element"
							:tabindex="element.action ? 0 : undefined"
							@click="() => doAction(element.action)"
							:class="element.classes"
							:style="{
								position: element.inset ? 'absolute' : undefined,
								inset: element.inset,
								minWidth: element.minWidth ? `${element.minWidth}cqw` : undefined,
								maxWidth: element.maxWidth ? `${element.maxWidth}cqw` : undefined,
								...element.style,
							}"
						>
							{{ element.content }}
						</div>
					</div>
				</template>
			</div>
		</div>

		<div
			v-if="showStartButton"
			class="absolute-full flex-center-all bg-contain cursor-pointer"
				:style="{ zIndex: 5, backgroundImage: `url('${useApiStore().apiUrl + '/thumb/' + encodeMediaPath(backgroundVideoPath || '') + '?seek=3&width=1200'}')`}"
				@click="() => { showStartButton = false; activeVideoPlayer?.videoRef?.play() }"
			>
				<Button class="square text-7xl" text btn-blur-hover btn-drop-shadow severity="contrast" data-focus-priority="1">
					<i class="material-symbols-outlined">play_arrow</i>
				</Button>
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

	.menu-wrapper {
		position: fixed;
		z-index: 5;
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

		&.scroll-x {
			overflow-x: auto;
			overflow-y: hidden;
			padding: 0 2px;
		}

		.frame-element {
			padding: .5em;

			&:hover, &:focus-within, &[tv-focus] {
				outline: 1px solid #fff;
			}
		}
	}

	.queued-video {
		opacity: 0;

		&.top {
			opacity: 1;
			z-index: 1;
		}
	}

}
</style>
