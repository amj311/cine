<script setup lang="ts">
import { computed, ref, onBeforeMount, watch, nextTick } from 'vue';
import { useQueryPathStore } from '@/stores/queryPath.store';
import Explorer from '@/views/browse/Explorer.vue';
import Scroll from '@/components/Scroll.vue';
import { useRoute } from 'vue-router';
import DropdownMenu from '@/components/utils/DropdownMenu.vue';
import CinemaLibraryPage from './CinemaLibraryPage.vue';
import { useApiStore } from '@/stores/api.store';
import PhotoLibraryPage from './PhotoLibraryPage.vue';
import AlbumPage from './AlbumPage.vue';
import AudiobookPage from './AudiobookPage.vue';
import CinemaItemPage from './CinemaItemPage.vue';

const route = useRoute();
const api = useApiStore().api;

// const scrollerRef = ref<InstanceType<typeof Scroll> | null>(null);
// const scrollArea = computed(() => scrollerRef.value?.scrollArea);

let fetchedPath = '';
const directory = ref<{ folders: { folderName: string; libraryItem }[]; files: string[] } | null>(null);
const libraryItem = ref<any>(null);
// const listMode = ref('grid');
const exploreMode = ref<'library' | 'files'>('library');

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

// maintain a stack of scroll positions for consistency when navigating backwards
const scrollStack = new Map<string, number>();

const loading = ref(false);
const longLoading = ref(false);

function awaitLongLoad() {
	const time = 200;
	const timeout = setTimeout(() => {
		longLoading.value = true;
	}, time);
	return () => {
		clearTimeout(timeout);
		longLoading.value = false;
	};
}

const fetchDirectory = async () => {
	const removeLongLoad = awaitLongLoad();
	try {
		loading.value = true;
		fetchedPath = queryPathStore.currentPath || '/';
	
		// normalize paths for accurate pairing
		const normalizedPath = queryPathStore.currentPath.replace(/[^A-Za-z0-9]/g, '');
		const normalizedItemPath = libraryItem.value?.relativePath.replace(/[^A-Za-z0-9]/g, '');
		// if (normalizedPath.includes(normalizedItemPath)) {
		// 	// save current scroll position when going down
		// 	if (libraryItem.value && scrollArea.value?.scrollTop) {
		// 		scrollStack.set(libraryItem.value.relativePath, scrollArea.value?.scrollTop);
		// 	}
		// }
		// else {
		// 	// when going up, remove the scroll position so it's not weird when we open it again
		// 	scrollStack.delete(libraryItem.value?.relativePath);
		// }

		const { data } = await api.get('/dir', { params: { dir: queryPathStore.currentPath || '/' } });
		directory.value = data.directory;
		libraryItem.value = data.libraryItem;

		// nextTick(() => {
		// 	const scrollPosition = scrollStack.get(libraryItem.value.relativePath);
		// 	scrollArea.value?.scrollTo(0, scrollPosition || 0);
		// });
	} catch (error) {
		console.error('Error fetching directory:', error);
	}
	finally {
		loading.value = false;
		removeLongLoad();
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
	<div style="height: 100%; position: relative">
		<div style="height: 100%;" :style="longLoading ? { opacity: 0.5, transition: '500ms' } : {}">
			<KeepAlive :include="['Explorer', 'CinemaLibraryPage', 'PhotoLibraryPage']">
				<template v-if="exploreMode === 'library' && libraryItem?.type === 'library' && libraryItem?.libraryType === 'photos'">
					<PhotoLibraryPage :libraryItem="libraryItem" :key="libraryItem.relativePath" />
				</template>

				<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'library' && libraryItem?.libraryType === 'cinema'">
					<CinemaLibraryPage :libraryItem="libraryItem" :key="libraryItem.relativePath" :folders="directory!.folders" />
				</template>

				<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'cinema'">
					<CinemaItemPage :libraryItem="libraryItem" :key="libraryItem.relativePath" />
				</template>

				<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'album'">
					<AlbumPage :libraryItem="libraryItem" :key="libraryItem.relativePath" :directory="directory" />
				</template>

				<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'audiobook'">
					<AudiobookPage :libraryItem="libraryItem" :key="libraryItem.relativePath" :directory="directory" />
				</template>

				<template v-else>
					<Explorer v-if="directory"
						:exploreMode="exploreMode"
						:directory="directory"
						:libraryItem="libraryItem"
					/>
				</template>
			</KeepAlive>
		</div>
		<div v-if="longLoading" class="loading">
			<i class="pi pi-spinner spin" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.loading {
	position: absolute;
	top: 5rem;
	left: 50%;
	transform: translate(-50%, -50%);
	font-size: 2rem;
	color: var(--text-color);
}
</style>
