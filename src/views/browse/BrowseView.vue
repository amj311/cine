<script setup lang="ts">
import { computed, ref, onBeforeMount, watch } from 'vue';
import api from '@/services/api';
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import MoviePage from '@/views/browse/MoviePage.vue';
import SeriesPage from '@/views/browse/SeriesPage.vue';
import Explorer from '@/views/browse/Explorer.vue';

const directory = ref<{ folders: { folderName: string; libraryItem }[]; files: string[] } | null>(null);
const libraryItem = ref<any>(null);
// const listMode = ref('grid');
const exploreMode = ref<'library' | 'files'>('library');

const queryPathStore = useQueryPathStore();
queryPathStore.updatePathFromQuery();

const fetchDirectory = async () => {
	try {
		const { data } = await api.get('/dir', { params: { dir: queryPathStore.currentPath || '/' } });
		directory.value = data.directory;
		libraryItem.value = data.libraryItem;
	} catch (error) {
		console.error('Error fetching directory:', error);
	}
};

onBeforeMount(() => {
	fetchDirectory();
});
watch(
	() => queryPathStore.currentPath,
	() => {
		fetchDirectory();
	}
);


</script>

<template>
	<div v-if="directory">
		<template v-if="exploreMode === 'library' && libraryItem?.type === 'movie'">
			<MoviePage :libraryItem="libraryItem" />
		</template>

		<template v-else-if="exploreMode === 'library' && libraryItem?.type === 'series'">
			<SeriesPage :libraryItem="libraryItem" />
		</template>

		<!-- TODO Series Page -->
		<template v-else>
			<Explorer
				:exploreMode="exploreMode"
				:directory="directory"
			/>
		</template>
	</div>
</template>

<style scoped lang="scss">
ul {
	list-style: none;
	padding: 0;
}

li {
	margin: 5px 0;
}

.poster-tile {
	display: inline-block;
	width: 150px;
	height: 200px;
	margin: 10px;
	cursor: pointer;
	user-select: none;
}
</style>
