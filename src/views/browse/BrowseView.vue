<script setup lang="ts">
import { computed, ref, onBeforeMount, watch, nextTick } from 'vue';
import { useQueryPathStore } from '@/stores/queryPath.store';
import MoviePage from '@/views/browse/MoviePage.vue';
import SeriesPage from '@/views/browse/SeriesPage.vue';
import Explorer from '@/views/browse/Explorer.vue';
import Scroll from '@/components/Scroll.vue';
import { useRoute } from 'vue-router';
import DropdownMenu from '@/components/utils/DropdownMenu.vue';
import MovieLibraryPage from './MovieLibraryPage.vue';
import { useApiStore } from '@/stores/api.store';
import PhotoLibraryPage from './PhotoLibraryPage.vue';

const route = useRoute();
const api = useApiStore().api;

const scrollerRef = ref<InstanceType<typeof Scroll> | null>(null);
const scrollArea = computed(() => scrollerRef.value?.scrollArea);

let fetchedPath = '';
const directory = ref<{ folders: { folderName: string; libraryItem }[]; files: string[] } | null>(null);
const libraryItem = ref<any>(null);
// const listMode = ref('grid');
const exploreMode = ref<'library' | 'files'>('library');

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

// maintain a stack of scroll positions for consistency when navigating backwards
const scrollStack = new Map<string, number>();

const fetchDirectory = async () => {
	try {
		fetchedPath = queryPathStore.currentPath || '/';
	
		// normalize paths for accurate pairing
		const normalizedPath = queryPathStore.currentPath.replace(/[^A-Za-z0-9]/g, '');
		const normalizedItemPath = libraryItem.value?.relativePath.replace(/[^A-Za-z0-9]/g, '');
		if (normalizedPath.includes(normalizedItemPath)) {
			// save current scroll position when going down
			if (libraryItem.value && scrollArea.value?.scrollTop) {
				scrollStack.set(libraryItem.value.relativePath, scrollArea.value?.scrollTop);
			}
		}
		else {
			// when going up, remove the scroll position so it's not weird when we open it again
			scrollStack.delete(libraryItem.value?.relativePath);
		}

		const { data } = await api.get('/dir', { params: { dir: queryPathStore.currentPath || '/' } });
		directory.value = data.directory;
		libraryItem.value = data.libraryItem;

		nextTick(() => {
			const scrollPosition = scrollStack.get(libraryItem.value.relativePath);
			scrollArea.value?.scrollTo(0, scrollPosition || 0);
		});
	} catch (error) {
		console.error('Error fetching directory:', error);
	}
};

onBeforeMount(() => {
	fetchDirectory();
});
watch(
	() => queryPathStore.currentPath,
	(newPath) => {
		// Only update if the in the 'browse' route
		if (route?.name !== 'browse') {
			return;
		}
		if (fetchedPath !== newPath) {
			fetchedPath = newPath;
			fetchDirectory();
		}
	}
);

</script>

<template>
	<div style="height: 100%;">
		<div style="width: 100%; height: 100%">
			<KeepAlive :include="['Explorer', 'MovieLibraryPage', 'PhotoLibraryPage']">
				<template v-if="exploreMode === 'library' && libraryItem?.type === 'library' && libraryItem?.libraryType === 'photos'">
					<PhotoLibraryPage :libraryItem="libraryItem" />
				</template>

				<Scroll v-else ref="scrollerRef">
					<div class="pl-3">
						<template v-if="exploreMode === 'library' && libraryItem?.type === 'library' && libraryItem?.libraryType === 'movies'">
							<MovieLibraryPage :libraryItem="libraryItem" :folders="directory!.folders" />
						</template>

						<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'movie'">
							<MoviePage :libraryItem="libraryItem" />
						</template>

						<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'series'">
							<SeriesPage :libraryItem="libraryItem" />
						</template>

						<template v-else>
							<Explorer v-if="directory"
								:exploreMode="exploreMode"
								:directory="directory"
							/>
						</template>
					</div>
				</Scroll>
			</KeepAlive>
		</div>

		<!-- Pad scroll bottom -->
			<br /><br />
	</div>
</template>

<style scoped lang="scss">

</style>
