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

const extraTypeLabels = {
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
						:progress="libraryItem.movie.watchProgress?.percentage"
					>
						<template #overlay>
							<button @click="() => playVideo(libraryItem.movie.relativePath)">Play</button>
						</template>
					</SimplePoster>
				</div>


				<h2>Extras</h2>
				<div class="hide-scrollbar">
					<div class="extras-list">
						<div class="extra-item" v-for="extra in libraryItem.extras" :key="extra.relativePath">
							<div class="extra-poster-wrapper">
								<SimplePoster
									:fallbackIcon="'🎥'"
									:progress="extra.watchProgress?.percentage"
									:aspectRatio="'wide'"
									:title="extra.name"
									:subtitle="extraTypeLabels[extra.type]"
								>
									<template #overlay>
										<button @click="() => playVideo(extra.relativePath)">Play</button>
									</template>
									<img :src="extra.poster" alt="Extra Poster" />
								</SimplePoster>
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

.extras-list {
	display: flex;
	gap: 10px;

	width: 100%;
	overflow-x: auto;
	overflow-y: hidden;
	white-space: nowrap;
}

.extra-poster-wrapper {
	width: 300px;
	display: inline-block;
	margin: 5px;
}
</style>
