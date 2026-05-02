<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { useApiStore } from '@/stores/api.store';
import { useUserStore } from '@/stores/user.store';
import TheaterPosterFrame from '@/components/TheaterPosterFrame.vue';
import NothingFound from '@/components/NothingFound.vue';
import NowPlayingSettingsModal from '@/components/NowPlayingSettingsModal.vue';
import Scroll from '@/components/Scroll.vue';

const titles = ref<any[]>([]);
const date = ref('');
const loading = ref(false);
const notConfigured = ref(false);

async function loadTitles() {
	try {
		loading.value = true;
		const { data } = await useApiStore().api.get('/now-playing');
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

const settingsModal = ref<InstanceType<typeof NowPlayingSettingsModal>>();
</script>

<template>
	<Scroll>
	<div class="now-playing-view">
		<div class="now-playing-header">
			<h2>Now Playing</h2>
			<Button
				v-if="useUserStore().isOwner"
				icon="pi pi-cog"
				variant="text"
				severity="secondary"
				@click="settingsModal?.open()"
			/>
		</div>
		<NowPlayingSettingsModal ref="settingsModal" />

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
</template>

<style scoped lang="scss">
.now-playing-view {
	padding: 1.5rem;
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
		--baseWidth: min(14rem, 40vw);
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
