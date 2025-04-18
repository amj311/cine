<script setup lang="ts">
import MetadataLoader from '@/components/MetadataLoader.vue';
import SimplePoster from '@/components/posters/MediaCard.vue';
import { useRouter } from 'vue-router';
import { useQueryPathStore } from '@/stores/queryPath.store';

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

</script>

<template>
	<div>
		<!-- Breadcrumb navigation -->
		<div>
			<span>
				<span @click="queryPathStore.goToRoot" style="cursor: pointer">🏠</span>
				&nbsp;/&nbsp;
			</span>
			<span v-if="queryPathStore.currentDir.length > 2">
				...
				&nbsp;/&nbsp;
			</span>
			<span v-if="queryPathStore.parentFile">
				<span @click="queryPathStore.goUp" style="cursor: pointer">{{ queryPathStore.parentFile }}</span>
				&nbsp;/&nbsp;
			</span>
			<span v-if="queryPathStore.currentFile">
				{{ queryPathStore.currentFile }}
			</span>
		</div>


		<template v-if="exploreMode === 'library'">
			<div class="library-grid">
				<template v-for="folder in directory.folders">
					<MetadataLoader
						v-if="folder.libraryItem"
						:key="folder.libraryItem.relativePath"
						:media="folder.libraryItem"
					>
						<template #default="{ metadata }">
							<div class="poster-tile" @click="queryPathStore.enterDirectory(folder.folderName)">
								<SimplePoster
									clickable
									:imageUrl="metadata?.poster"
									:fallbackIcon="folder.libraryItem.type === 'movie' ? '🎬' : '🗂️'"
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
</template>

<style scoped lang="scss">
ul {
	list-style: none;
	padding: 0;
}

li {
	margin: 5px 0;
}

.library-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 20px;
	padding: 20px;
}
.poster-tile {
	display: inline-block;
	width: 100%;
}
</style>
