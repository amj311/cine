<script
	setup
	lang="ts"
>
import SimplePoster from '@/components/posters/MediaCard.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
defineProps<{
	libraryItem: any; // libraryItem
}>();

const episodeTypeLabels = {
	'trailer': 'Trailer',
	'featurette': 'Featurette',
	'behindthescenes': 'Behind the Scenes',
	'deleted': 'Deleted Content',
}


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
	<MetadataLoader
		:media="libraryItem"
	>
		<template #default="{ metadata, isLoadingMetadata }">
			<div class="movie-page">
				<div class="poster-wrapper">
					<SimplePoster
						:imageUrl="metadata?.poster"
					/>
				</div>


				<div v-for="season in libraryItem.seasons" :key="season.relativePath">
					<h2>Season {{ season.seasonNumber}}</h2>
					<div class="hide-scrollbar">
						<div class="episodes-list">
							<div class="episode-item" v-for="episode in season.episodes" :key="episode.relativePath">
								<div class="episode-poster-wrapper">
									<SimplePoster
										:fallbackIcon="'🎥'"
										:progress="episode.watchProgress?.percentage"
										:aspectRatio="'wide'"
										:title="'Episode ' + episode.episodeNumber"
									>
										<template #overlay>
											<button @click="() => playVideo(episode.relativePath)">Play</button>
										</template>
									</SimplePoster>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</MetadataLoader>
</template>

<style
	lang="scss"
	scoped
>
.poster-wrapper {
	width: 300px;
}

.episodes-list {
	display: flex;
	gap: 10px;

	width: 100%;
	overflow-x: auto;
	overflow-y: hidden;
	white-space: nowrap;
}

.episode-poster-wrapper {
	width: 200px;
	display: inline-block;
	margin: 5px;
}
</style>
