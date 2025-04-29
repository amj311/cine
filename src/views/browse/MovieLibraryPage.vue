<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import api from '@/services/api';
import MediaCard from '@/components/MediaCard.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
	folders: { folderName: string; libraryItem }[];
}>();

const allItems = ref<any[]>([]);

async function loadItems() {
	try {
		const { data } = await api.get(`/rootLibrary/${props.libraryItem.relativePath}/flat`);
		allItems.value = data.data;
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(() => {
	loadItems();
});

const categories = computed(() => {
	return props.folders.map((folder) => ({
			...folder.libraryItem,
			order: folder.libraryItem.feedOrder || (Math.ceil(Math.random()) * 100),
		}))
		.filter(item => ['collection', 'folder'].includes(item.type))
		.sort((a, b) => a.order - b.order);
});
const categorySampling = computed(() => {
	const categoriesMap = new Map<string, any[]>();
	console.log(allItems.value)
	allItems.value.forEach((item) => {
		if (item.type !== 'movie') {
			return;
		}
		// cacetgory is the first level under the library
		const itemCategoryRelativePath = item.relativePath.split('/').slice(0, 2).join('/');
		if (!categoriesMap.has(itemCategoryRelativePath)) {
			categoriesMap.set(itemCategoryRelativePath, []);
		}
		categoriesMap.get(itemCategoryRelativePath)?.push(item);
	});
	// Take a random 10 items from each category
	categoriesMap.forEach((items, category) => {
		categoriesMap.set(category, items.sort(() => Math.random() - 0.5).slice(0, 10));
	});
	return categoriesMap;
})

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
	<div class="movies-page">
		<div class="categories flex flex-column gap-4">
			<div class="categories-row" v-for="categoriesRow in categories" :key="categoriesRow.relativePath">
				<h3>
					{{ categoriesRow.name }}
					<Button variant="text" severity="contrast"><i class="pi pi-angle-right" /></Button>
				</h3>
				<div class="categories-scroll-wrapper">
					<Scroll class="categories-scroll">
						<div class="categories-row-items-list">
							<div
								class="categories-row-card-wrapper"
								v-for="item in categorySampling.get(categoriesRow.relativePath)"
							>
								<MetadataLoader
									:media="item"
								>
									<template #default="{ metadata }">
										<MediaCard
											:key="item.relativePath"
											:imageUrl="metadata?.poster_thumb"
											:playSrc="item.relativePath"
											:progress="item.watchProgress"
											:aspectRatio="'tall'"
											:title="item.name"
											:subtitle="item.year"
										>
											<template #fallbackIcon>🎬</template>
										</MediaCard>
									</template>
								</MetadataLoader>
							</div>
							<Button variant="text" severity="contrast"
								class="px-4"
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
		display: flex;
		gap: 15px;
	}

	.categories-row-card-wrapper {
		width: min(125px, 30vw);
		min-width: min(125px, 30vw);
	}
}

</style>
