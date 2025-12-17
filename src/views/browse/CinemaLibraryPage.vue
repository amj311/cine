<script setup lang="ts">
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import SelectButton from 'primevue/selectbutton';
import InputText from 'primevue/inputtext';

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

const filterMode = ref<string>('Categories');
// Don't allow removing the option by clicking it agian
watch(filterMode, (newVal, oldVal) => {
	if (!newVal) {
		nextTick(() => {
			filterMode.value = oldVal;
		});
	}
});

const cinemaItems = computed(() => allItems.value.filter(item => item.type === 'cinema'));

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
		// Support items at the root level, w/o category
		.concat({
			name: 'Uncategorized',
			relativePath: props.libraryItem.relativePath,
			folderName: '',
			order: 9999,
			type: 'library',
		})
		.sort((a, b) => a.order - b.order);
});

function collectCategorySamples() {
	const categoriesMap: Record<string, Array<any>> = {};
	cinemaItems.value.forEach((item) => {
		// category is the first level under the library, that is NOT the folder name
		const itemCategoryRelativePath = item.relativePath.replace('/' + item.folderName, '').split('/').slice(0, 2).join('/');
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


const cinemaType = ref<'all' | 'movie' | 'series'>('all');
const filteredItems = computed(() => {
	if (cinemaType.value === 'all') {
		return cinemaItems.value;
	}
	return cinemaItems.value.filter(item => item.cinemaType === cinemaType.value);
});

const letterGroups = computed(() => {
	const groups: Record<string, Array<any>> = {};
	filteredItems.value.forEach((item) => {
		const firstLetter = item.sortKey.charAt(0).toUpperCase();
		if (!groups[firstLetter]) {
			groups[firstLetter] = [];
		}
		groups[firstLetter]!.push(item);
	});
	return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, items]) => ({
		letter,
		items: items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
	})) as Array<{ letter: string; items: Array<any> }>;
});


const searchTerm = ref<string>('');
const seachedItems = computed(() => {
	return cinemaItems.value.filter(item => !searchTerm.value || item.name.toLowerCase().replaceAll(/[^\d\w\s]/g, '').includes(searchTerm.value.toLowerCase().replaceAll(/[^\d\w\s]/g, '')));
});

</script>

<template>
	<Scroll>
		<div class="cinema-page mt-3 pl-3">

			<div class="filters mb-4 flex justify-content-center">
					<SelectButton v-model="filterMode" :options="['Categories', 'A - Z', 'search']" size="large">
						<template #option="{ option }">
							<div v-if="option === 'A - Z'" class="flex align-items-center gap-2 white-space-nowrap">
								<div>A - Z</div>
								<select v-if="filterMode === 'A - Z'" v-model="cinemaType" size="small" class="border-none bg-transparent w-full" style="color: inherit;" @click.stop>
									<option value="all">All</option>
									<option value="movie">Movies</option>
									<option value="series">Series</option>
								</select>
							</div>
							<div v-else-if="option === 'search'" class="flex align-items-center gap-2">
								<i class="pi pi-search absolute" />
								<div class="absolute pl-4 pointer-events-none" v-if="filterMode !== 'search'">Search</div>
								<div class="search-container" :class="{ on: filterMode === 'search' }">
									<InputText v-model="searchTerm" placeholder="Search" name="search" size="small" class="border-none p-0 pl-4 bg-transparent w-full" style="color: inherit;" />
								</div>
							</div>
							<span v-else>{{ option }}</span>
						</template>
					</SelectButton>
			</div>

			<div v-if="filterMode === 'Categories'" class="categories flex flex-column gap-1">
				<template v-for="categoriesRow in categories" :key="categoriesRow.relativePath">
					<div class="categories-row" v-if="categorySampling[categoriesRow.relativePath] && categorySampling[categoriesRow.relativePath].length" :key="categoriesRow.relativePath">
						<h3>
							{{ categoriesRow.name }}
							<Button variant="text" severity="contrast" @click="$router.push({ name: 'browse', query: { path: categoriesRow.relativePath } })">
								<i class="pi pi-angle-right" />
							</Button>
						</h3>
						<div class="categories-scroll-wrapper">
							<Scroll>
								<div class="categories-row-items-list">
									<div
										class="card-wrapper"
										v-for="item in categorySampling[categoriesRow.relativePath]"
									>
										<LibraryItemCard :libraryItem="item" />
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
				</template>
			</div>

			<div v-if="filterMode === 'A - Z'">
				<div
					class="mb-4"
					v-for="group in letterGroups"
					:key="group.letter"
				>
					<div class="mb-2">
						<span class="text-5xl font-bold">{{ group.letter }}</span>
						<span class="text-sm text-600 ml-2">({{ group.items.length }})</span>
					</div>

					<div class="flex flex-wrap gap-3">
						<div
							class="card-wrapper"
							v-for="item in group.items"
							:key="item.relativePath"
						>
							<LibraryItemCard :libraryItem="item" />
						</div>
					</div>
				</div>
			</div>


			<div v-if="filterMode === 'search'">
				<h3 v-if="searchTerm">Showing {{ seachedItems.length }} results for '{{ searchTerm }}':</h3>
				<h3 v-else>All {{ cinemaItems.length }} titles:</h3>
				<div class="mt-3">
					<div class="flex flex-wrap gap-3">
						<div
							class="card-wrapper"
							v-for="item in seachedItems"
							:key="item.relativePath"
						>
							<LibraryItemCard :libraryItem="item" />
						</div>
					</div>
				</div>
			</div>


		</div>
	</Scroll>
</template>

<style scoped lang="scss">

.card-wrapper {
	width: min(min(7rem, 19vh), 20vw);
	min-width: min(min(7rem, 19vh), 20vw);
}

.categories-row {
	--padding: 15px;

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
}


.search-container {
	color: inherit;
	transition: width 500ms;
	min-width: 0;
	width: 5.5rem;
	opacity: 0;

	&.on {
		opacity: 1;
		width: 10rem;
	}
}

</style>
