<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { ref, onBeforeMount, onBeforeUnmount, computed } from 'vue';
import api from '@/services/api'
import { MetadataService } from '@/services/metadataService';

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const mediaPath = computed(() => queryPathStore.currentPath || '')
const playerRef = ref<InstanceType<typeof VideoPlayer>>();

const isLoadingMetadata = ref(false);
const metadata = ref<any>(null);

async function loadMetadata() {
	try {
		isLoadingMetadata.value = true;
		metadata.value = await MetadataService.getMetadata({ relativePath: mediaPath.value }, true);
	} catch (error) {
		console.error('Error loading metadata', error);
	} finally {
		isLoadingMetadata.value = false;
	}
}


async function initialProgress() {
	if (!mediaPath) {
		return;
	}
	try {
		const { data } = await api.get('/watchProgress', {
			params: {
				relativePath: mediaPath,
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

onBeforeMount(() => {
	loadMetadata();
	initialProgress();
})

const PROGRESS_INTERVAL = 1000 * 60;
const progressUpdateInterval = setInterval(async () => {
	try {
		const progress = playerRef.value?.getProgress();
		if (!progress) {
			return;
		}
		await api.post('/watchProgress', {
			relativePath: mediaPath,
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
	<div class="movie-theater">
		<VideoPlayer ref="playerRef" v-if="mediaPath" :src="mediaPath" />
	</div>
</template>

<style
	lang="scss"
	scoped
>
	.movie-theater {
		height: 100%;
	}
</style>
