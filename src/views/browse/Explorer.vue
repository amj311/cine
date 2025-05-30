<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { computed } from 'vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import CollectionPoster from '@/components/CollectionPoster.vue';

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

const folders = computed(() => {
	return props.directory.folders.filter(folder => folder.libraryItem && folder.libraryItem.type === 'folder');
});
const items = computed(() => {
	return props.directory.folders.filter(folder => folder.libraryItem && folder.libraryItem.type !== 'folder');
});

</script>

<template>
	<Scroll>
		<div class="mt-3 pl-3 pr-2 pb-3">
			<template v-if="exploreMode === 'library'">
				<div class="folder-grid" v-if="folders.length">
					<template v-for="folder in folders">
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
					<div class="grid-tile"
						v-for="folder in items"
						:key="folder.libraryItem.relativePath"
					>
						<template v-if="folder.libraryItem.type === 'movie'">
							<MetadataLoader
								:media="folder.libraryItem"
							>
								<template #default="{ metadata }">
									<MediaCard
										clickable
										:imageUrl="metadata?.poster_thumb"
										:aspectRatio="'tall'"
										:title="folder.libraryItem.name"
										:subtitle="folder.libraryItem.year"
										:progress="folder.libraryItem.movie?.watchProgress"
										:action="() => queryPathStore.enterDirectory(folder.folderName)"
									>
										<template #fallbackIcon>🎞️</template>
									</MediaCard>
								</template>
							</MetadataLoader>
						</template>

						<template v-if="folder.libraryItem.type === 'series'">
							<MetadataLoader
								:media="folder.libraryItem"
							>
								<template #default="{ metadata }">
									<MediaCard
										clickable
										:imageUrl="metadata?.poster_thumb"
										:aspectRatio="'tall'"
										:title="folder.libraryItem.name"
										:subtitle="`${folder.libraryItem.numSeasons} Season${folder.libraryItem.numSeasons.length ? 's' : ''}`"
										:progress="folder.libraryItem.movie?.watchProgress"
										:action="() => queryPathStore.enterDirectory(folder.folderName)"
									>
										<template #fallbackIcon>📺</template>
									</MediaCard>
								</template>
							</MetadataLoader>
						</template>

						<template v-if="folder.libraryItem.type === 'album' || folder.libraryItem.type === 'audiobook'">
							<MetadataLoader
								:media="folder.libraryItem"
							>
								<template #default="{ metadata }">
									<MediaCard
										clickable
										:imageUrl="folder.libraryItem.cover_thumb"
										:aspectRatio="'square'"
										:title="folder.libraryItem.title"
										:subtitle="folder.libraryItem.artist"
										:progress="folder.libraryItem.watchProgress"
										:action="() => queryPathStore.enterDirectory(folder.folderName)"
									>
										<template #fallbackIcon>💿</template>
									</MediaCard>
								</template>
							</MetadataLoader>
						</template>

						<template v-if="folder.libraryItem.type === 'collection'">
							<MediaCard
								clickable
								:aspectRatio="'tall'"
								:title="folder.libraryItem.name"
								:subtitle="`${folder.libraryItem.children.length} items`"
								:action="() => queryPathStore.enterDirectory(folder.folderName)"
							>
								<template #poster v-if="folder.libraryItem.children.length">
									<CollectionPoster :paths="folder.libraryItem.children" />
								</template>
								<template #fallbackIcon v-else>🗂️</template>
							</MediaCard>
						</template>
					</div>
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
	</Scroll>
</template>

<style scoped lang="scss">
.folder-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	gap: 15px;
	margin-bottom: 30px;
}
.item-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
	gap: 15px;
}
.grid-tile {
	width: 100%;
}
</style>
