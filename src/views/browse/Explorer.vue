<script setup lang="ts">
import { useRouter, viewDepthKey } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { computed, onBeforeMount, onBeforeUnmount, ref, shallowRef } from 'vue';
import LibraryItemCard from '@/components/LibraryItemCard.vue';
import CinemaItemsFilter from './CinemaItemsFilter.vue';
import type { VirtualScrollRow } from '@/components/VirtualScroll.vue';
import VirtualScroll from '@/components/VirtualScroll.vue';
import GalleryFileCard from '@/components/GalleryFileCard.vue';
import type { GalleryFile } from '@/components/GalleryFileFrame.vue';
import Slideshow from '@/components/Slideshow.vue';
import PhotoTimelineView from './PhotoTimelineView.vue';
import type SelectButton from 'primevue/selectbutton';

const props = defineProps<{
	exploreMode: 'library' | 'files';
	directory: {
		libraryItems: any[];
		galleryFiles: GalleryFile[];
		folders: any[];
		files: string[];
	};
	libraryItem: any;
	rootLibrary: any;
}>();

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const folderItems = computed(() => {
	return props.directory.libraryItems.filter(item => item.type === 'folder');
});
const cinemaItems = computed(() => {
	return props.directory.libraryItems.filter(item => ['cinema', 'collection'].includes(item.type));
});
const audioItems = computed(() => {
	return props.directory.libraryItems.filter(item => ['audiobook', 'album'].includes(item.type));
});
const mediaItems = computed(() => [...audioItems.value, ...cinemaItems.value]);
const galleryFiles = computed(() => {
	return props.directory.galleryFiles;
});

const LibraryFilters = {
	'cinema': CinemaItemsFilter,
}
const LibraryViewOptions = {
	'photos': [
		{ label: 'Timeline', value: PhotoTimelineView },
	],
}
const filterComponent = computed(() => LibraryFilters[props.rootLibrary.libraryType]);
const filterRef = ref<InstanceType<typeof filterComponent.value>>();

const viewComponent = shallowRef('explore');
const viewOptions = computed(() => LibraryViewOptions[props.rootLibrary.libraryType] ? [
	{ label: 'Explore', value: 'explore' },
	...LibraryViewOptions[props.rootLibrary.libraryType],
] : null)

const displayItems = computed(() => filterRef.value ? filterRef.value.filteredItems : mediaItems.value);


const itemsPerRow = ref(7);
const itemHeight = ref(0);

function determineItemsPerRow() {
	let newValue = 7;
	const breakpoints = [
		{ width: 1280, items: 7 },
		{ width: 1024, items: 5 },
		{ width: 768, items: 3 },
	];
	breakpoints.forEach((breakpoint) => {
		if (window.innerWidth <= breakpoint.width) {
			newValue = breakpoint.items;
		}
	});
	itemsPerRow.value = newValue;
	itemHeight.value = window.innerWidth / itemsPerRow.value;
}

onBeforeMount(() => {
	determineItemsPerRow();
	window.addEventListener('resize', determineItemsPerRow);
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', determineItemsPerRow);
})

const galleryRows = computed<Array<VirtualScrollRow>>(() => [
	...computeRows('gallery', galleryFiles.value, itemHeight.value, itemsPerRow.value),
]);

function computeRows<T>(type: string, allItems: Array<T>, height: number, itemsPerRow: number) {
	const rows: Array<VirtualScrollRow> = [];

	const rowCount = Math.ceil(allItems.length / itemsPerRow);
	for (let i = 0; i < rowCount; i++) {
		const start = i * itemsPerRow;
		const end = Math.min(start + itemsPerRow, allItems.length);
		const items = allItems.slice(start, end);
		
		rows.push({
			height,
			data: {
				type,
				items,
			},
		});
	}

	return rows;
}


const slideshow = ref<InstanceType<typeof Slideshow>>();
function openSlideshow(file: GalleryFile) {
	slideshow.value?.open(galleryFiles.value, file);
}

</script>

<template>
	<div class="h-full flex flex-column gap-3">
		<div class="flex-row-center px-2">
			<SelectButton v-if="viewOptions" v-model="viewComponent" :options="viewOptions" optionLabel="label" optionValue="value" />
			<div class="flex-grow-1" />
			<component v-if="filterComponent" :is="filterComponent" ref="filterRef" :items="mediaItems" />
		</div>
		<div class="flex-grow-1" style="max-height: 100%; height: 100%; overflow-y: hidden;">
			<template v-if="viewComponent !== 'explore'">
				<component :is="viewComponent" :relativePath="useQueryPathStore().currentPath" />
			</template>
			<template v-else>
				<Scroll>
					<div class="mt-3 pl-3 pb-3">
						<div class="flex flex-column gap-5">
							<div class="folder-grid" v-if="folderItems.length">
								<template v-for="folder in folderItems">
									<div class="grid-tile">
										<MediaCard
											clickable
											aspectRatio="wide"
											:title="folder.name"
											:action="() => queryPathStore.goTo(folder.relativePath)"
										>
											<template #fallbackIcon>🗂️</template>
										</MediaCard>
									</div>
								</template>
							</div>

							<div class="item-grid" v-if="displayItems.length">
								<div class="grid-tile"
									v-for="childItem in displayItems"
									:key="childItem.relativePath"
								>
									<LibraryItemCard :libraryItem="childItem" />
								</div>
							</div>

							<!-- Extras and gallery items can overlap, so hide gallery if extras are in the libraryItem -->
							<VirtualScroll v-if="directory.galleryFiles?.length && !libraryItem?.extras" :rows="galleryRows">
								<template #row="{ data }" :key="day.date" class="date-row" :data-track-anchor="day.date">
									<div v-if="data.type === 'gallery'" class="gallery-grid h-full" :style="{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }">
										<div
											class="gallery-cell"
											v-for="item in data.items"
											:key="item?.relativePath"
											:id="item?.relativePath"
											@click="openSlideshow(item)"
										>
											<GalleryFileCard :file="item" />
										</div>
									</div>
								</template>
							</VirtualScroll>

							<div v-if="libraryItem.extras?.length > 0">	
								<h2>Extras</h2>
								<ExtrasList :extras="libraryItem.extras" />
							</div>
						</div>
					</div>
				</Scroll>

				<Slideshow ref="slideshow" />
			</template>
		</div>
	</div>
	
</template>

<style scoped lang="scss">
.folder-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(8rem, 27vh), 1fr));
	gap: 15px;
}
.item-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(7rem, 19vh), 1fr));
	gap: 15px;
}
.grid-tile {
	width: 100%;
}


.gallery-grid {
	display: grid;

	.gallery-cell {
		overflow: hidden;
		padding: 3%;
	}
}
</style>
