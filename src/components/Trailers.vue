<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProfileStore } from '@/stores/profile.store';
import { useApiStore } from '@/stores/api.store';
import VideoPlayer from '@/components/VideoPlayer.vue';

const emit = defineEmits<{
	end: [];
	close: [];
}>();

const profileStore = useProfileStore();
const api = useApiStore().api;

const trailers = ref<any[]>([]);
const currentIndex = ref(0);
const isLoading = ref(false);

async function fetchTrailers() {
	isLoading.value = true;
	try {
		const { data } = await api.get('/trailers', {
			params: { profileId: profileStore.activeProfile?.id },
			});
		if (data?.data?.length) {
			trailers.value = data.data;
			} else {
			emit('end');
			}
		} catch (e) {
		console.error('Failed to fetch trailers', e);
			emit('end');
		} finally {
		isLoading.value = false;
		}
	}

function onTrailerEnd() {
	if (currentIndex.value < trailers.value.length - 1) {
		currentIndex.value++;
	} else {
		emit('end');
	}
}

onMounted(() => {
	if (!profileStore.activeProfile?.preRollTrailers) {
		emit('end');
		return;
	}
	fetchTrailers();
});

</script>

<template>
	<div v-if="trailers[currentIndex]" class="trailers-container">
		<VideoPlayer
			:relativePath="trailers[currentIndex].relativePath"
			:autoplay="true"
			:onEnd="onTrailerEnd"
			:close="() => emit('close')"
		/>
	</div>
</template>

<style lang="scss" scoped>
.trailers-container {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: #000;
	z-index: 10;
}
</style>
