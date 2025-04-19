<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { computed } from 'vue';

const router = useRouter();

const props = defineProps<{
	exploreMode: 'library' | 'files';
	directory: {
		folders: { folderName: string; libraryItem }[];
		files: string[];
	};
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

const collections = computed(() => {
	return props.directory.folders.filter(folder => folder.libraryItem && folder.libraryItem.type === 'collection');
});
const items = computed(() => {
	return props.directory.folders.filter(folder => folder.libraryItem && folder.libraryItem.type !== 'collection');
});

</script>

<template>
	<div>
		<!-- Breadcrumb navigation -->
		<div>
			<span>
				<Button icon="pi pi-user" @click="queryPathStore.goToRoot" style="cursor: pointer" variant="text" severity="secondary">🏠</Button>
				/
			</span>
			<span v-if="queryPathStore.currentDir.length > 2">
				...
				/
			</span>
			<span v-if="queryPathStore.parentFile">
				<Button @click="queryPathStore.goUp" style="cursor: pointer" variant="text" severity="secondary">{{ queryPathStore.parentFile }}</button>
				/
			</span>
			<span v-if="queryPathStore.currentFile">
				<Button variant="text" severity="secondary" class="font-bold">{{ queryPathStore.currentFile }}</Button>
			</span>
		</div>

		<div class="p-3 flex flex-column gap-6">
			<template v-if="exploreMode === 'library'">
				<div class="folder-grid" v-if="collections.length">
					<template v-for="folder in collections">
						<MetadataLoader
							v-if="folder.libraryItem"
							:key="folder.libraryItem.relativePath"
							:media="folder.libraryItem"
						>
							<template #default="{ metadata }">
								<div class="grid-tile" @click="queryPathStore.enterDirectory(folder.folderName)">
									<MediaCard
										clickable
										aspectRatio="wide"
										:fallbackIcon="'🗂️'"
										:title="folder.libraryItem.name"
										:subtitle="folder.libraryItem.year || `${folder.libraryItem.children.length} items`"
										:progress="folder.libraryItem.movie?.watchProgress?.percentage"
									/>
								</div>
							</template>
						</MetadataLoader>
					</template>
				</div>

				<div class="item-grid">
					<template v-for="folder in items">
						<MetadataLoader
							v-if="folder.libraryItem"
							:key="folder.libraryItem.relativePath"
							:media="folder.libraryItem"
						>
							<template #default="{ metadata }">
								<div class="grid-tile" @click="queryPathStore.enterDirectory(folder.folderName)">
									<MediaCard
										clickable
										:imageUrl="metadata?.poster_thumb"
										:fallbackIcon="folder.libraryItem.type === 'movie' ? '🎞️' : '📺'"
										:aspectRatio="'tall'"
										:title="folder.libraryItem.name"
										:subtitle="folder.libraryItem.year || `${folder.libraryItem.children.length} items`"
										:progress="folder.libraryItem.movie?.watchProgress?.percentage"
									/>
								</div>
							</template>
						</MetadataLoader>
					</template>
				</div>
			</template>

			<template v-else>
				<ul>
					<li
						v-for="folder in directory.folders"
						:key="folder.folderName"
						@click="queryPathStore.enterDirectory(folder.folderName)"
						style="cursor: pointer"
					>
						🗂️ {{ folder.folderName }}
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

.folder-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	gap: 20px;
}
.item-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
	gap: 20px;
}
.grid-tile {
	width: 100%;
}
</style>
