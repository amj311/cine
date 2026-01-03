<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { computed, ref } from 'vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import LibraryItemCard from '@/components/LibraryItemCard.vue';
import CinemaItemsFilter from './CinemaItemsFilter.vue';

const router = useRouter();

const props = defineProps<{
	exploreMode: 'library' | 'files';
	directory: {
		libraryItems: any[];
		folders: any[];
		files: string[];
	};
	libraryItem: any;
	rootLibrary: any;
}>();

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

function playVideo(path: string) {
	router.push({
		name: 'play',
		query: {
			path
		},
	})
}

const folderItems = computed(() => {
	return props.directory.libraryItems.filter(item => item.type === 'folder');
});
const childItems = computed(() => {
	return props.directory.libraryItems.filter(item => item.type !== 'folder');
});

const LibraryFilters = {
	'cinema': CinemaItemsFilter,
}
const filterComponent = computed(() => LibraryFilters[props.rootLibrary.libraryType]);
const filterRef = ref<InstanceType<typeof filterComponent.value>>();

const displayItems = computed(() => filterRef.value ? filterRef.value.filteredItems : props.directory.libraryItems)

</script>

<template>
	<Scroll>
		<div class="mt-3 pl-3 pr-2 pb-3">
			<div v-if="exploreMode === 'library'" class="flex flex-column gap-5">
				<div class="flex justify-content-end" v-if="filterComponent">
					<component :is="filterComponent" ref="filterRef" :items="directory.libraryItems" />
				</div>
				<div class="folder-grid" v-if="folderItems.length">
					<template v-for="folder in folderItems">
						<div class="grid-tile">
							<MediaCard
								clickable
								aspectRatio="wide"
								:title="folder.name"
								:subtitle="`${folder.children.length} items`"
								:action="() => queryPathStore.goTo(folder.relativePath)"
							>
								<template #fallbackIcon>🗂️</template>
							</MediaCard>
						</div>
					</template>
				</div>

				<div class="item-grid">
					<div class="grid-tile"
						v-for="childItem in displayItems"
						:key="childItem.relativePath"
					>
						<LibraryItemCard :libraryItem="childItem" />
					</div>
				</div>

				<div v-if="libraryItem.extras?.length > 0">	
					<h2>Extras</h2>
					<ExtrasList :extras="libraryItem.extras" />
				</div>
			</div>

			<template v-else>
				<ul>
					<li
						v-for="folder in directory.folders"
						:key="folder.libraryItem.relativePath"
						@click="queryPathStore.goTo(folder.libraryItem.relativePath)"
						style="cursor: pointer"
					>
						🗂️ {{ folder.libraryItem.folderName }}
					</li>
					<li v-for="file in directory.files" :key="file">
						<span v-if="file.endsWith('.mp4')">🎬</span>
						<span v-else>📄</span>
						{{ file }}
						<!-- Add play button for video files -->
						<button
							v-if="file.endsWith('.mp4')"
							@click="playVideo(queryPathStore.currentPath + '/' + file)"
						>
							Play
						</button>
					</li>
				</ul>
			</template>
		</div>
	</Scroll>
</template>

<style scoped lang="scss">
.folder-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(10rem, 27vh), 1fr));
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
</style>
