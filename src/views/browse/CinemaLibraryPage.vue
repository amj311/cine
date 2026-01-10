<script setup lang="ts">
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import SelectButton from 'primevue/selectbutton';
import InputText from 'primevue/inputtext';
import { useQueryPathStore } from '@/stores/queryPath.store';
import CinemaItemsFilter from './CinemaItemsFilter.vue';
import { encodeMediaPath } from '@/utils/miscUtils';

const props = defineProps<{
	libraryItem: any; // libraryItem
	directoryItems: any[];
}>();

const allFlatItems = ref<any[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get('/flat?path=' + encodeMediaPath(props.libraryItem.relativePath));
		allFlatItems.value = data.data?.items || [];
		collectCategorySamples();
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(async () => {
	// initializeRandomOrder(); // no longer shuffling categories
	await loadItems();
});

const displayMode = ref<string>('Categories');
// Don't allow removing the option by clicking it agian
watch(displayMode, (newVal, oldVal) => {
	if (!newVal) {
		nextTick(() => {
			displayMode.value = oldVal;
		});
	}
});

const cinemaItems = computed(() => allFlatItems.value.filter(item => item.type === 'cinema'));

const categoryOrder: Record<string, number> = {};
function initializeRandomOrder() {
	props.directoryItems.forEach((folder) => {
		categoryOrder[folder.relativePath] = folder.feedOrder || (Math.ceil(Math.random() * 100));
	});
}
const categorySampling = ref<Record<string, Array<any>>>({});

const categories = computed(() => {
	return props.directoryItems
		.sort((a, b) => {
			return (b.feedOrder || 0) - (a.feedOrder || 0);
		})
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


const filter = ref<InstanceType<typeof CinemaItemsFilter>>();
const filteredItems = computed(() => filter.value?.filteredItems || []);

const letterGroups = computed(() => {
	const groups: Record<string, Array<any>> = {};
	filteredItems.value.forEach((item: {sortKey: string, surprise?: any }) => {
		let firstLetter = item.sortKey.charAt(0).toUpperCase();
		if (!firstLetter.match(/[A-Z]/)) {
			firstLetter = '#';
		}
		if (item.surprise) {
			firstLetter = 'surprise';
		}
		if (!groups[firstLetter]) {
			groups[firstLetter] = [];
		}
		groups[firstLetter]!.push(item);
	});
	return Object.entries(groups).sort(([a], [b]) => {
		if (a === 'surprise') return -1;
		if (b === 'surprise') return 1;
		return a.localeCompare(b);
	}).map(([letter, items]) => ({
		letter,
		items: items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
	})) as Array<{ letter: string; items: Array<any> }>;
});

</script>

<template>
	<Scroll>
		<div class="cinema-page mt-3 pl-3 flex flex-column gap-4">

			<div class="filters flex justify-content-center">
				<SelectButton v-model="displayMode" :options="['Categories', 'A - Z']" size="large" />
			</div>

			<div v-if="displayMode === 'Categories'" class="categories flex flex-column gap-1">
				<template v-for="categoriesRow in categories" :key="categoriesRow.relativePath">
					<div class="categories-row" v-if="categorySampling[categoriesRow.relativePath] && categorySampling[categoriesRow.relativePath].length" :key="categoriesRow.relativePath">
						<Button variant="text" severity="contrast" @click="useQueryPathStore().goTo(categoriesRow.relativePath)">
							<h3>
								{{ categoriesRow.name }}
							</h3>
							<i class="pi pi-angle-right" />
						</Button>
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
										@click="useQueryPathStore().goTo(categoriesRow.relativePath)"
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

			<template v-if="displayMode === 'A - Z'">

				<div class="flex justify-content-end">
					<CinemaItemsFilter ref="filter" :items="cinemaItems" />
				</div>

				<div class="flex flex-wrap gap-5">
					<div
						class="letter-group"
						v-for="group in letterGroups"
						:key="group.letter"
					>
						<div class="mb-2">
							<span class="text-5xl font-bold">
								<template v-if="group.letter === 'surprise'"><i class="pi pi-gift" /></template>
								<template v-else>{{ group.letter }}</template>
							</span>
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
			</template>

		</div>
		<br />
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
