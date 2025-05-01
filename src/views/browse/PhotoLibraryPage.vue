<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import MediaCard from '@/components/MediaCard.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import { useApiStore } from '@/stores/api.store';
import Lazy from '@/components/Lazy.vue';
import Scroll from '@/components/Scroll.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
}>();

const allItems = ref<any[]>([]);
const allFiles = ref<any[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get(`/rootLibrary/${props.libraryItem.relativePath}/flat`);
		allItems.value = data.data?.items || [];
		allFiles.value = data.data?.files || [];
		computeTimelineDays();
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(async () => {
	await loadItems();
});

const timelineDays = ref<Array<{date: string, items: Array<any>}>>([]);
function computeTimelineDays() {
	const days: Record<string, any> = {};
	allFiles.value.forEach((file) => {
		if (!file.takenAt) {
			return;
		}
		const itemDateString = new Date(file.takenAt).toISOString().slice(0,7);// by month
		if (!days[itemDateString]) {
			days[itemDateString] = [];
		}
		days[itemDateString].push(file);
	});
	timelineDays.value = Object.entries(days).map(([date, items]) => ({
		date,
		items,
	})).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	return timelineDays.value;
};

</script>

<template>
		<div class="movies-page mt-3">
			<div class="categories flex flex-column gap-3">
				<Lazy>
					<template #default="{ inRange }">
						<div v-for="day in timelineDays" :key="day.date" class="date-row">
							<br />
							<br />
							<h2>{{ day.date }}</h2>
							<div class="photo-grid">
								<div v-for="file in day.items" :key="file.relativePath" :id="file.relativePath" class="photo-cell lazy-load">
									<div v-if="file.type === 'photo' && inRange[file.relativePath]" style="width: 100%; height: 100%;">
										<img 
											:src="useApiStore().baseUrl + '/thumb/' + file.relativePath + '?width=300'" 
											:alt="file.fileName" 
											style="width: 100%; height: 100%; object-fit: cover;" 
										/>
									</div>
								</div>
							</div>
						</div>
					</template>
				</Lazy>
			</div>
		</div>
</template>

<style scoped lang="scss">
.categories-row {
	--padding: 15px;

	h2 {
		// margin-bottom: 10px;
	}

	.categories-scroll-wrapper {
		margin: 0 calc(-1 * var(--padding));
		width: 100%;
	}

	.categories-row-items-list {
		padding: 10px var(--padding);
		padding-right: 0;
		display: flex;
		gap: 15px;
	}

	.categories-row-card-wrapper {
		width: min(100px, 20vw);
		min-width: min(100px, 20vw);
	}
}

.photo-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 10px;

	.photo-cell {
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: var(--color-background-mute);
		border-radius: 5px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	}
}

</style>
