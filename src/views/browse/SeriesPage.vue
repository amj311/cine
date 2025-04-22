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

function playVideo(path: string, startTime?: number) {
	router.push({
		name: 'play',
		query: {
			path,
			startTime,
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
			episodes: season.episodeFiles.flatMap((file: any) => file.episodes).map(episode => {
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
	// Find the episode with the most recent watch time
	const scored = mergedSeasons.value.flatMap((season: any) => season.episodes).map((episode: any) => {
		let score = 0;
		if (!episode.watchProgress) {
			score = 0;
		}
		else if (episode.watchProgress.percentage >= 90) {
			score = 0;
		}
		else {
			score = episode.watchProgress?.watchedAt
		}
		return {
			...episode,
			score,
		};
	}).filter((episode: any) => episode.score > 0).reverse();
	return scored[0] || mergedSeasons.value[0].episodes[0];
});

const resumeTime = computed(() => {
	if (episodeToPlay.value?.watchProgress?.percentage < 90) {
		return episodeToPlay.value?.watchProgress.time;
	}
	return 0;
});

</script>

<template>
	<div class="series-page">
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
				<div style="display: flex; gap: 10px; flex-wrap: wrap;">
					<span v-if="libraryItem.year">{{ libraryItem.year }}</span>
					<span v-if="metadata?.runtime">{{ formatRuntime(metadata.runtime) }}</span>
					<span v-if="metadata?.content_rating">{{ metadata.content_rating }}</span>
				</div>

				<StarRating class="my-4" v-if="!isNaN(metadata?.rating)" :rating="metadata.rating" :votes="metadata.votes" />

				<div class="flex gap-2">
					<Button
						class="play-button"
						@click="() => playVideo(episodeToPlay?.relativePath, resumeTime)"
					>
						<i class="pi pi-play" />
						{{ resumeTime ? 'Resume' : 'Play' }} S{{ episodeToPlay?.seasonNumber }}:E{{ episodeToPlay?.episodeNumber }}
					</Button>
					<Button
						v-if="resumeTime"
						:size="'large'"
						variant="text"
						severity="contrast"
						@click="() => playVideo(episodeToPlay.relativePath, episodeToPlay.startTime)"
					>
						<i class="pi pi-replay" />
					</Button>
				</div>

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
					<div class="episodes-list flex flex-column gap-3">
						<template v-for="(episode, i) in activeSeason.episodes" :key="episode.relativePath">
							<div class="episode-item">
								<div class="episode-poster-wrapper">
									<MediaCard
										:imageUrl="episode.still_thumb"
										:fallbackIcon="'📺'"
										:aspectRatio="'wide'"
										:playSrc="episode.relativePath"
										:overrideStartTime="episode.startTime"
										:progress="episode.watchProgress"
									/>
								</div>
								<div class="episode-info">
									<h3>{{ episode.name }}</h3>
									<div style="display: flex; gap: 10px; flex-wrap: wrap;">
										<span>Ep. {{ episode.episodeNumber }}</span>
										<span v-if="episode.runtime">{{ formatRuntime(episode.runtime) }}</span>
										<span v-if="episode.content_rating">{{ episode.content_rating }}</span>
									</div>
									<p>{{ episode.overview }}</p>
								</div>
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

		<div v-if="libraryItem.extras?.length > 0">	
			<h2>Extras</h2>
			<ExtrasList :extras="libraryItem.extras" />
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

.series-page {
	display: flex;
	flex-direction: column;
	gap: 50px;
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

.episode-item {
	display: flex;
	gap: 20px;

	.episode-poster-wrapper {
		width: min(200px, 30vw);
		min-width: min(200px, 30vw);
	}
}
</style>
