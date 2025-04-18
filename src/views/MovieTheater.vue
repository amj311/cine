<script
	setup
	lang="ts"
>
import { useQueryPathStore } from '@/stores/queryPath.store'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { reactive, ref, onBeforeMount, onBeforeUnmount } from 'vue';
import api from '@/services/api'

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();


const state = reactive({
	currentMedia: queryPathStore.currentPath || '',
})

const playerRef = ref<InstanceType<typeof VideoPlayer>>();

async function fetchProgress() {
	if (!state.currentMedia) {
		return;
	}
	try {
		const { data } = await api.get('/watchProgress', {
			params: {
				relativePath: state.currentMedia,
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
	fetchProgress();
})

const PROGRESS_INTERVAL = 1000 * 60;
const progressUpdateInterval = setInterval(async () => {
	try {
		const progress = playerRef.value?.getProgress();
		if (!progress) {
			return;
		}
		await api.post('/watchProgress', {
			relativePath: state.currentMedia,
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
		<VideoPlayer ref="playerRef" v-if="state.currentMedia" :src="state.currentMedia" />
	</div>
</template>

<style
	lang="scss"
	scoped
>
	.movie-theater {
		height: 100vh;
	}
</style>
