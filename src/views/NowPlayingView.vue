<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { useApiStore } from '@/stores/api.store';
import TheaterPosterFrame from '@/components/TheaterPosterFrame.vue';
import NothingFound from '@/components/NothingFound.vue';
import Scroll from '@/components/Scroll.vue';
import { useProfileStore } from '@/stores/profile.store';

const titles = ref<any[]>([]);
const date = ref('');
const loading = ref(false);
const notConfigured = ref(false);

async function loadTitles() {
	try {
		loading.value = true;
		const profileId = useProfileStore().activeProfileId;
		if (!profileId) {
			notConfigured.value = true;
			return;
		}
		const { data } = await useApiStore().api.get('/now-playing', { params: { profileId } });
		titles.value = data.titles ?? [];
		date.value = data.date ?? '';
		notConfigured.value = titles.value.length === 0;
	} catch (e) {
		console.error('Error loading Now Playing:', e);
		notConfigured.value = true;
	} finally {
		loading.value = false;
	}
}

onBeforeMount(() => {
	loadTitles();
});
</script>

<template>
	<div class="h-full w-full">
		<Scroll>
			<div class="now-playing-view">
				<div class="now-playing-header">
					<h2>Now Playing</h2>
				</div>

				<div v-if="loading" class="now-playing-loading">
					<i class="pi pi-spinner spin" />
					Loading...
				</div>

				<NothingFound v-else-if="notConfigured" />

				<div v-else class="now-playing-grid">
					<div
						v-for="item in titles"
						:key="item.relativePath"
						class="now-playing-card-wrapper"
						:class="item.type"
					>
						<TheaterPosterFrame :libraryItem="item" />
					</div>
				</div>
			</div>
		</Scroll>
	</div>
</template>

<style scoped lang="scss">
.now-playing-view {
	padding: 1.5rem;
	padding-top: 0;
	min-height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.now-playing-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 1.5rem;

	h2 {
		margin: 0;
	}
}

.now-playing-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 3rem;
}

.now-playing-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	justify-content: center;

	.now-playing-card-wrapper {
		--baseWidth: min(11rem, 35vw);
		width: var(--baseWidth);
		min-width: var(--baseWidth);
		max-width: var(--baseWidth);

		&.album,
		&.audiobook {
			--baseWidth: min(12rem, 35vw);
		}
	}
}
</style>
