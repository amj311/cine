<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { computed } from 'vue';
import MetadataLoader from '@/components/MetadataLoader.vue';

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

const fodlers = computed(() => {
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
				<div class="folder-grid" v-if="fodlers.length">
					<template v-for="folder in fodlers">
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

						<template v-if="folder.libraryItem.type === 'collection'">
							<MediaCard
								clickable
								:aspectRatio="'tall'"
								:title="folder.libraryItem.name"
								:subtitle="`${folder.libraryItem.children.length} items`"
								:action="() => queryPathStore.enterDirectory(folder.folderName)"
							>
								<template #poster v-if="folder.libraryItem.children.length">
									<MetadataLoader v-for="(childPath, i) in folder.libraryItem.children.slice(0, 2)" :key="childPath" :media="{ relativePath: childPath }">
										<template #default="{ metadata }">
											<img
												:src="metadata?.poster_thumb"
												:alt="folder.libraryItem.name"
												:style="{
													position: 'absolute',
													width: `90%`,
													borderRadius: '5px',
													top: `${i * 10}px`,
													left: `${i * 10}px`,
													zIndex: 10 - i,
													opacity: 1 - i * 0.2,
												}"
											/>
										</template>
									</MetadataLoader>
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
