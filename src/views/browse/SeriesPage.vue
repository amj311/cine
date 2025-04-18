<script
	setup
	lang="ts"
>
import { useRouter } from 'vue-router';
import { computed, onBeforeUnmount, ref } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useBackgroundStore } from '@/stores/background.store';

const router = useRouter();
const props = defineProps<{
	libraryItem: any; // libraryItem
}>();
const backgroundStore = useBackgroundStore();

const extraTypeLabels = {
	'trailer': 'Trailer',
	'featurette': 'Featurette',
	'behindthescenes': 'Behind the Scenes',
	'deleted': 'Deleted Content',
}

const metadata = ref<any>(null);
const isLoadingMetadata = ref(false);

async function loadMetadata() {
	try {
		isLoadingMetadata.value = true;
		metadata.value = await MetadataService.getMetadata(props.libraryItem, true);
		if (metadata.value) {
			backgroundStore.setBackgroundUrl(metadata.value.background);
		}
	} catch (error) {
		console.error('Error loading metadata', error);
	} finally {
		isLoadingMetadata.value = false;
	}
}

loadMetadata();

onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
});

function playVideo(path: string) {
	router.push({
		name: 'play',
		query: {
			path
		},
	})
}

function formatRuntime(minutes: number) {
	const hours = Math.floor(minutes / 60);
	const minutesOver = minutes % 60;
	if (hours === 0) {
		return `${minutesOver}min`;
	}
	return `${hours}hr ${minutesOver}min`;
}


// Combine libraryItem.season with matching metadata from metadata.seasons
const activeSeason = ref(metadata.value?.seasons[0] || null);

const mergedSeasons = computed(() => {
	const seasons = props.libraryItem.seasons.map((season: any) => {
		const metadataSeason = metadata.value?.seasons.find((s: any) => s.seasonNumber === season.seasonNumber);
		return {
			...season,
			...metadataSeason,
			name: season.seasonNumber === 0 ? 'Specials' : season.name,
			episodes: season.episodes.map((episode: any) => {
				const metadataEpisode = metadataSeason?.episodes.find((e: any) => e.episodeNumber === episode.episodeNumber);
				return {
					...episode,
					...metadataEpisode,
				};
			}),
		};
	});
	// Sort seasons by season number bu put specials last
	seasons.sort((a: any, b: any) => {
		if (a.seasonNumber === 0) {
			return 1;
		}
		if (b.seasonNumber === 0) {
			return -1;
		}
		return a.seasonNumber - b.seasonNumber;
	});

	// Select the first season that is not specials
	activeSeason.value = seasons.find((season: any) => season.seasonNumber !== 0) || seasons[0];
	return seasons;
});

const episodeToPlay = computed(() => {
	if (!activeSeason.value) {
		return null;
	}
	return activeSeason.value.episodes[0];
});

</script>

<template>
	<div class="movie-page">
		<div class="top-wrapper">
			<div>
			<div class="poster-wrapper">
				<MediaCard
					:imageUrl="metadata?.poster_full"
				/>
			</div>
		</div>

			<div class="left-side" :style="{ flexGrow: 1 }">

				<h1 class="title">{{ libraryItem.name }}</h1>
				<p style="display: flex; gap: 10px; flex-wrap: wrap;">
					<span v-if="libraryItem.year">{{ libraryItem.year }}</span>
					<span v-if="metadata?.runtime">{{ formatRuntime(metadata.runtime) }}</span>
					<span v-if="metadata?.content_rating">{{ metadata.content_rating }}</span>
				</p>
				<StarRating v-if="!isNaN(metadata?.rating)" :rating="metadata.rating" :votes="metadata.votes" />
				<br />

				<button
					style="zoom: 1.5"
					class="play-button"
					@click="() => playVideo(episodeToPlay?.relativePath)"
				>
					Play S{{ episodeToPlay?.seasonNumber }}:E{{ episodeToPlay?.episodeNumber }}
				</button>

				<p class="hide-md" style="max-width: 50em;"><br /><br />{{ metadata?.overview }}</p>
			</div>
		</div>
	
		<p class="show-lg">{{ metadata?.overview }}</p>

		<div v-if="metadata?.credits">
			<h2>Cast & Crew</h2>
			<PeopleList :people="metadata.credits" />
		</div>

		<div>
			<h2 class="mb-2">Episodes</h2>
			<div class="season-wrapper">
				<div class="selection">
					<Button
						v-for="season in mergedSeasons"
						:key="season.seasonNumber"
						class="season-button"
						severity="secondary"
						:variant="activeSeason.seasonNumber === season.seasonNumber ? '' : 'text'"
						@click="() => activeSeason = season"
					>
						{{ season.name || `Season ${ season.seasonNumber }` }}
					</Button>
				</div>
				<div class="season-details">
					<p>{{ activeSeason.overview }}</p>
					<div class="episodes-list">
						<div class="episode-item" v-for="episode in activeSeason.episodes" :key="episode.relativePath">
							<div class="episode-poster-wrapper">
								<MediaCard
									:imageUrl="episode.still_thumb"
									:fallbackIcon="'📺'"
									:progress="episode.watchProgress?.percentage"
									:aspectRatio="'wide'"
									:playSrc="episode.relativePath"
								/>
							</div>
							<div class="episode-info">
								<h3>{{ episode.episodeNumber }}: {{ episode.name }}</h3>
								<div style="display: flex; gap: 10px; flex-wrap: wrap;">
									<span v-if="episode.year">{{ episode.year }}</span>
									<span v-if="episode.runtime">{{ formatRuntime(episode.runtime) }}</span>
									<span v-if="episode.content_rating">{{ episode.content_rating }}</span>
								</div>
								<p>{{ episode.overview }}</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div v-if="libraryItem.extras?.length > 0">	
			<h2>Extras</h2>
			<div class="hide-scrollbar">
				<div class="extras-list">
					<div class="extra-item" v-for="extra in libraryItem.extras" :key="extra.relativePath">
						<div class="extra-poster-wrapper">
							<MediaCard
								:fallbackIcon="'🎥'"
								:progress="extra.watchProgress?.percentage"
								:aspectRatio="'wide'"
								:title="extra.name"
								:subtitle="extraTypeLabels[extra.type]"
								:playSrc="extra.relativePath"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style
	lang="scss"
	scoped
>

.show-lg {
	display: none;
}

@media screen and (max-width: 800px) {
	.hide-md {
		display: none;
	}
	.show-lg {
		display: inherit;
	}
	.title {
		font-size: 1.5rem;
	}
}

@media screen and (max-width: 600px) {
	.hide-sm {
		display: none;
	}
	.title {
		font-size: 1.5rem;
	}
}

.movie-page {
	display: flex;
	flex-direction: column;
	gap: 50px;
	padding: 20px;
}

.top-wrapper {
	display: flex;
	align-items: end;
	gap: 20px;
}

.poster-wrapper {
	width: min(250px, 30vw);
	min-width: min(250px, 30vw);
}

.extras-list {
	display: flex;
	gap: 20px;
	padding: 10px;
	margin: 0 -10px;
	width: 100%;
	overflow-x: auto;
	white-space: nowrap;
}

.extra-poster-wrapper {
	width: min(250px, 30vw);
}


.episode-item {
	display: flex;
	gap: 20px;

	.episode-poster-wrapper {
		width: min(200px, 30vw);
		min-width: min(200px, 30vw);
	}
}
</style>
