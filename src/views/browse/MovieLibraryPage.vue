<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import MediaCard from '@/components/MediaCard.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import { useApiStore } from '@/stores/api.store';

const props = defineProps<{
	libraryItem: any; // libraryItem
	folders: { folderName: string; libraryItem }[];
}>();

const allItems = ref<any[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get(`/rootLibrary/${props.libraryItem.relativePath}/flat`);
		allItems.value = data.data?.items || [];
		collectCategorySamples();
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(async () => {
	initializeRandomOrder();
	await loadItems();
});

const categoryOrder: Record<string, number> = {};
function initializeRandomOrder() {
	props.folders.forEach((folder) => {
		categoryOrder[folder.libraryItem.relativePath] = folder.libraryItem.feedOrder || (Math.ceil(Math.random() * 100));
	});
}
const categorySampling = ref<Record<string, Array<any>>>({});

const categories = computed(() => {
	return props.folders.map((folder) => ({
			...folder.libraryItem,
			order: categoryOrder[folder.libraryItem.relativePath] || 100,
		}))
		.filter(item => ['collection', 'folder'].includes(item.type))
		.sort((a, b) => a.order - b.order);
});

function collectCategorySamples() {
	const categoriesMap: Record<string, Array<any>> = {};
	allItems.value.forEach((item) => {
		if (item.type !== 'movie') {
			return;
		}
		// cacetgory is the first level under the library
		const itemCategoryRelativePath = item.relativePath.split('/').slice(0, 2).join('/');
		if (!categoriesMap[itemCategoryRelativePath]) {
			categoriesMap[itemCategoryRelativePath] = [];
		}
		categoriesMap[itemCategoryRelativePath]!.push(item);
	});
	// Take a random 10 items from each category
	Object.entries(categoriesMap).forEach(([category, items]) => {
		categoriesMap[category] = items.sort(() => Math.random() - 0.5).slice(0, 10);
	});
	categorySampling.value = categoriesMap;
};

/**
 * "xhr ymin" format
 * @param watchProgress 
 */
function timeRemaining(watchProgress: any) {
	const time = watchProgress.time;
	const duration = watchProgress.duration;
	const remainingTime = duration - time;
	const hours = Math.floor(remainingTime / 3600);
	const minutes = Math.floor((remainingTime % 3600) / 60);

	return `${hours ? (hours + 'hr ') : '' }${minutes}min`;
}

</script>

<template>
	<Scroll>
		<div class="movies-page mt-3 pl-3">
			<div class="categories flex flex-column gap-3">
				<div class="categories-row" v-for="categoriesRow in categories" :key="categoriesRow.relativePath">
					<h3>
						{{ categoriesRow.name }}
						<Button variant="text" severity="contrast" @click="$router.push({ name: 'browse', query: { path: categoriesRow.relativePath } })">
							<i class="pi pi-angle-right" />
						</Button>
					</h3>
					<div class="categories-scroll-wrapper">
						<Scroll class="categories-scroll">
							<div class="categories-row-items-list">
								<div
									class="categories-row-card-wrapper"
									v-for="item in categorySampling[categoriesRow.relativePath]"
								>
									<MetadataLoader
										:media="item"
									>
										<template #default="{ metadata }">
											<MediaCard
												:key="item.relativePath"
												:imageUrl="metadata?.poster_thumb"
												:progress="item.watchProgress"
												:aspectRatio="'tall'"
												:title="item.name"
												:subtitle="item.year"
												:action="() => $router.push({ name: 'browse', query: { path: item.relativePath } })"
											>
												<template #fallbackIcon>🎬</template>
											</MediaCard>
										</template>
									</MetadataLoader>
								</div>
								<Button variant="text" severity="contrast"
									class="px-4"
									style="white-space: nowrap; min-width: 10em"
									@click="$router.push({ name: 'browse', query: { path: categoriesRow.relativePath } })"
								>
									View All
									<i class="pi pi-angle-right" />
								</Button>
							</div>
						</Scroll>
					</div>
				</div>
			</div>
		</div>
	</Scroll>
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
		width: min(7rem, 20vw);
		min-width: min(7rem, 20vw);
	}
}

</style>
