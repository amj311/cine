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
		<div class="mt-3 pr-2">
			<template v-if="exploreMode === 'library'">
				<div class="folder-grid" v-if="collections.length">
					<template v-for="folder in collections">
						<MetadataLoader
							v-if="folder.libraryItem"
							:key="folder.libraryItem.relativePath"
							:media="folder.libraryItem"
						>
							<template #default="{ metadata }">
								<div class="grid-tile">
									<MediaCard
										clickable
										aspectRatio="wide"
										:title="folder.libraryItem.name"
										:subtitle="`${folder.libraryItem.children.length} items`"
										:action="() => queryPathStore.enterDirectory(folder.folderName)"
									>
										<template #fallbackIcon>🗂️</template>
									</MediaCard>
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
								<div class="grid-tile">
									<MediaCard
										clickable
										:imageUrl="metadata?.poster_thumb"
										:aspectRatio="'tall'"
										:title="folder.libraryItem.name"
										:subtitle="folder.libraryItem.numSeasons ? `${folder.libraryItem.numSeasons} Season${folder.libraryItem.numSeasons.length ? 's' : ''}` : folder.libraryItem.year"
										:progress="folder.libraryItem.movie?.watchProgress"
										:action="() => queryPathStore.enterDirectory(folder.folderName)"
									>
										<template #fallbackIcon>{{ folder.libraryItem.type === 'movie' ? '🎞️' : '📺' }}</template>
									</MediaCard>
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
.folder-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	gap: 15px;
	margin-bottom: 30px;
}
.item-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
	gap: 15px;
}
.grid-tile {
	width: 100%;
}
</style>
