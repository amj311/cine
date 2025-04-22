<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import api from '@/services/api'
import { MetadataService } from '@/services/metadataService';
import { useRoute } from 'vue-router';
import { useTvNavigationStore } from '@/stores/tvNavigation.store';

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const mediaPath = computed(() => queryPathStore.currentPath || '')
const playerRef = ref<InstanceType<typeof VideoPlayer>>();
const theatreRef = ref<InstanceType<typeof HTMLElement>>();

const showControlsTime = 2500;
const hideControlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const showControls = ref(false);
function updateShowControlsTimeout() {
	if (hideControlsTimeout.value) {
		clearTimeout(hideControlsTimeout.value);
	}
	showControls.value = true;
	hideControlsTimeout.value = setTimeout(() => {
		showControls.value = false;
	}, showControlsTime);
} 

// const isLoadingMetadata = ref(false);
// const metadata = ref<any>(null);

// async function loadMetadata() {
// 	try {
// 		isLoadingMetadata.value = true;
// 		metadata.value = await MetadataService.getMetadata({ relativePath: mediaPath.value }, true);
// 	} catch (error) {
// 		console.error('Error loading metadata', error);
// 	} finally {
// 		isLoadingMetadata.value = false;
// 	}
// }

const route = useRoute();

async function initialProgress() {
	if (!mediaPath) {
		return;
	}
	const query = route?.query;
	if (query.startTime) {
		playerRef.value!.setTime(Number(query.startTime));
		// remove route start time
		history.replaceState(
			{},
			'',
			route.path + '?' + new URLSearchParams({ ...(route.query || {}), startTime: '' }).toString(),
		)
		return;
	}

	try {
		const { data } = await api.get('/watchProgress', {
			params: {
				relativePath: mediaPath.value,
			}
		})
		if (data.data) {
			playerRef.value?.setTime(data.data.time)
		}
	}
	catch (e) {
		console.error(e)
	}
}

let wakeLock: WakeLockSentinel | null = null;

let wasTvMode = false;
function pauseTvMode() {
	if (useTvNavigationStore().enabled) {
		wasTvMode = true;
		useTvNavigationStore().disengageTvMode();
	}
}
function resumeTvMode() {
	if (wasTvMode) {
		wasTvMode = false;
		useTvNavigationStore().engageTvMode();
	}
}


onMounted(async () => {
	// Pause TV mode to allow interaction with VideoPlayer UI
	pauseTvMode();
	// loadMetadata();
	initialProgress();
	try {
		await document.documentElement.requestFullscreen();
	} catch (e) {
		console.error("Failed to enter fullscreen", e);
	}
	if ('wakeLock' in navigator) {
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch (e) {
			console.error("Failed to acquire wake lock", e);
		}
	}

	// Setup control hiding
	theatreRef.value?.addEventListener('mousemove', () => {
		updateShowControlsTimeout();
	});

})

onBeforeUnmount(async () => {
	// Resume TV mode
	resumeTvMode();
	
	document.exitFullscreen();
	// release wake lock
	if (wakeLock) {
		await wakeLock.release();
		wakeLock = null;
	}
});

const PROGRESS_INTERVAL = 1000 * 30;
const progressUpdateInterval = setInterval(async () => {
	try {
		const progress = playerRef.value?.getProgress();
		if (!progress) {
			return;
		}
		await api.post('/watchProgress', {
			relativePath: mediaPath.value,
			progress,
		});
	}
	catch (e) {
		console.error("Failed to update progress")
		console.error(e);
	}
}, PROGRESS_INTERVAL);


onBeforeUnmount(() => {
	clearInterval(progressUpdateInterval);
})

</script>

<template>
	<div ref="theatreRef" class="movie-theater" :class="{ 'show-controls': showControls }">
		<VideoPlayer ref="playerRef" v-if="mediaPath" :src="mediaPath" />
		<div class="top-left overlay">
			<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="$router.back()" />
		</div>
	</div>
</template>

<style
	lang="scss"
	scoped
>
	.movie-theater {
		height: 100%;
		position: relative;

		.overlay {
			color: #fff !important;
			opacity: 0;
			transition: 500ms;
			zoom: 1.5;
		}
		&.show-controls {
			.overlay {
				opacity: 1;
			}
		}

		.top-left {
			position: absolute;
			top: 10px;
			left: 10px;
			z-index: 1000;
		}
	}
</style>
