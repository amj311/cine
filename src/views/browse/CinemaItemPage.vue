<script
	setup
	lang="ts"
>
import { useRouter } from 'vue-router';
import { computed, onBeforeMount, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useBackgroundStore } from '@/stores/background.store';
import ExtrasList from '@/components/ExtrasList.vue';
import { useWatchProgressStore } from '@/stores/watchProgress.store';
import Skeleton from 'primevue/skeleton';
import { GetListByKeyword } from 'youtube-search-api';
import { useApiStore } from '@/stores/api.store';
import axios from 'axios';
import { useTvNavigationStore } from '@/stores/tvNavigation.store';

const router = useRouter();
const props = defineProps<{
	libraryItem: any; // libraryItem
}>();
const backgroundStore = useBackgroundStore();

const metadata = ref<any>(null);
const isLoadingMetadata = ref(false);

async function loadMetadata() {
	try {
		isLoadingMetadata.value = true;
		metadata.value = await MetadataService.getMetadata(props.libraryItem, true);
		if (metadata.value) {
			backgroundStore.setBackgroundUrl(metadata.value.background);
			backgroundStore.setPosterUrl(metadata.value.background);
		}
	} catch (error) {
		console.error('Error loading metadata', error);
	} finally {
		isLoadingMetadata.value = false;
	}
}


onBeforeMount(async () => {
	loadMetadata();
});
onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
	backgroundStore.clearPosterUrl();
});


const isSeries = computed(() => props.libraryItem.cinemaType === 'series');


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
	const minutesOver = Math.floor(minutes % 60);
	if (hours === 0) {
		return `${minutesOver}min`;
	}
	return `${hours}hr ${minutesOver}min`;
}

/***************
 * SERIES SEASONS & EPISODES
 */

 // Combine libraryItem.season with matching metadata from metadata.seasons
const episodeToPlay = ref<any>(null);
const activeSeason = ref(metadata.value?.seasons[0] || null);

const mergedSeasons = computed(() => {
	if (!isSeries.value ) {
		return [];
	}
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
	return seasons;
});


watch(() => mergedSeasons.value, determineEpisodeToPlay, { immediate: true, deep: true });

function determineEpisodeToPlay() {
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
	const episode = scored[0] || mergedSeasons.value[0]?.episodes[0] || null;
	
	// Use this opportunity to update the active season based on the last watched episode
	activeSeason.value =
		mergedSeasons.value.find((season: any) => season.seasonNumber === episode?.seasonNumber)
		// Or select the first season that is not specials
		|| mergedSeasons.value.find((season: any) => season.seasonNumber !== 0)
		|| mergedSeasons.value[0];

	episodeToPlay.value = episode;
};


const resumable = computed(() => {
	return isSeries.value ? episodeToPlay.value : props.libraryItem.movie;
})
const resumeTime = computed(() => {
	if (resumable.value?.watchProgress && resumable.value.watchProgress.percentage < 90) {
		return resumable.value?.watchProgress.time;
	}
	return 0;
});
const playText = computed(() => {
	if (isSeries.value) {
		return `${ resumeTime.value ? 'Resume' : 'Play' } S${ episodeToPlay.value?.seasonNumber }:E${ episodeToPlay.value?.episodeNumber }`;
	}
	return `${ resumeTime.value ? `Resume (${Math.round(resumable.value.watchProgress.percentage)}%)` : 'Play' }`;
});

watch(
	() => useWatchProgressStore().lastWatchProgress,
	(lastProgress) => {
		let media;
		if (isSeries.value) {
			media = mergedSeasons.value.flatMap((season: any) => season.episodes).find((episode: any) => episode.relativePath === lastProgress?.relativePath);
		} else {
			// only update for the main movie, ot for extras
			media = lastProgress?.relativePath === resumable.value.relativePath ? resumable.value : null;
		}
		if (media) {
			media.watchProgress = lastProgress.progress;
			if (isSeries.value) {
				episodeToPlay.value = media;
			}
		}
	}
)

const ytAudio = ref<HTMLAudioElement | null>(null);
const ytCanPlay = ref(false);
const ytIsplaying = ref(false);

function fadeIn(event: Event) {
	const el = event.target as HTMLAudioElement;
	if (!el) return;
	ytIsplaying.value = true;
	el.volume = 0;
	const maxVolume = 0.25; // Max volume level
	const fadeDuration = 10000; // Duration of the fade-in in milliseconds
	const stepDuration = 100; // Interval duration in milliseconds
	const stepAmount = (maxVolume / fadeDuration) * stepDuration;
	const interval = setInterval(() => {
		el.volume += stepAmount;
		if (el.volume >= maxVolume) {
			el.volume = maxVolume;
			clearInterval(interval);
		}
	}, stepDuration);
}

function stopYtAudio() {
	if (ytAudio.value) {
		ytAudio.value.pause();
		ytAudio.value.currentTime = 0;
		ytIsplaying.value = false;
	}
}
function playYtAudio() {
	if (ytAudio.value && ytCanPlay.value) {
		ytAudio.value.play().catch(err => {
			console.warn("Error playing yt audio:", err);
		});
	}
}
onUnmounted(() => {
	if (ytAudio.value) {
		ytAudio.value.volume = 0;
		ytAudio.value.pause();
	}
});

</script>

<template>
	<Scroll>
		<div class="cinema-page pl-3 pr-2">
			<div class="top-wrapper">
				<div>
					<div class="poster-wrapper">
						<MediaCard
							:imageUrl="metadata?.poster_full"
							:progress="resumable?.watchProgress"
							:loading="isLoadingMetadata"
						/>
					</div>
				</div>

				<div class="left-side" :style="{ flexGrow: 1 }">

					<h1 class="title line-clamp-3">{{ libraryItem.name }}</h1>
					<div style="display: flex; column-gap: 10px; flex-wrap: wrap; align-items: center;">
						<span v-if="libraryItem.year">{{ libraryItem.year }}</span>
						<span v-if="metadata?.runtime">{{ formatRuntime(metadata.runtime) }}</span>
						<span v-if="metadata?.content_rating">{{ metadata.content_rating }}</span>
					</div>

					<br />
					<StarRating :rating="metadata?.rating || 0" :votes="metadata?.votes || 0" />

					<br />
					<div class="flex align-items-center">
						<Button
							:size="'large'"
							class="play-button"
							@click="() => playVideo(resumable.relativePath, resumeTime)"
							data-focus-priority="1"
						>
							<i class="pi pi-play" />
							{{ playText }}
						</Button>
						<Button
							v-if="resumeTime"
							:size="'large'"
							variant="text"
							severity="contrast"
							@click="() => playVideo(resumable.relativePath, resumable.startTime || 0)"
						>
							<i class="pi pi-replay" />
						</Button>
						<Button
							v-if="ytCanPlay"
							:icon="ytIsplaying ? 'pi pi-volume-up pi-spin' : 'pi pi-volume-up'"
							:size="'large'"
							variant="text"
							severity="contrast"
							@click="() => (ytIsplaying ? stopYtAudio() : playYtAudio())"
						/>
					</div>
					

					<div class="hide-md" style="max-width: 50em;">
						<br />
						<template v-if="isLoadingMetadata">
							<Skeleton width="100%" height="20px" class="my-1" />
							<Skeleton width="100%" height="20px" class="my-1" />
							<Skeleton width="100%" height="20px" class="my-1" />
							<Skeleton width="33%" height="20px" class="my-1" />
						</template>
						<template v-else>
						<p class="line-clamp-3">{{ metadata?.overview }}</p>
						<span v-if="metadata?.genres.length">Genres: <i>{{ metadata?.genres.join(', ') }}</i></span>
						</template>
					</div>
				</div>
			</div>
		
			<div class="show-sm">
				<template v-if="isLoadingMetadata">
					<Skeleton width="100%" height="20px" class="my-1" />
					<Skeleton width="100%" height="20px" class="my-1" />
					<Skeleton width="100%" height="20px" class="my-1" />
					<Skeleton width="33%" height="20px" class="my-1" />
				</template>
				<template v-else>
					<p>{{ metadata?.overview }}</p>
					<span v-if="metadata?.genres.length">Genres: <i>{{ metadata?.genres.join(', ') }}</i></span>
				</template>
			</div>

			<div v-if="isLoadingMetadata || metadata?.credits">
				<h2>Cast & Crew</h2>
				<PeopleList :loading="isLoadingMetadata" :people="metadata?.credits" />
			</div>

			<div v-if="isSeries">
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
					<div class="season-details" v-if="activeSeason">
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
											:loading="isLoadingMetadata"
										/>
									</div>
									<div class="episode-info flex-grow-1">
										<h3>{{ episode.name }}{{ episode.version ? ` (${episode.version})` : '' }}</h3>
										<div style="display: flex; gap: 10px; flex-wrap: wrap;">
											<span>Ep. {{ episode.episodeNumber }}</span>
											<span v-if="episode.runtime">{{ formatRuntime(episode.runtime) }}</span>
											<span v-if="episode.content_rating">{{ episode.content_rating }}</span>
										</div>
										
										<p>
											<template v-if="isLoadingMetadata">
												<Skeleton width="100%" height="20px" class="my-1" />
												<Skeleton width="33%" height="20px" class="my-1" />
											</template>
											<template v-else>
												{{ episode.overview }}
											</template>
										</p>
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

			<audio ref="ytAudio" :src="useApiStore().apiUrl + '/stream-yt-search?q=' + (`${libraryItem.name} ${libraryItem.year} music ost main theme`).replace(/[&?=/]/g, '')" controls :autoplay="useTvNavigationStore().detectedTv" @canplay="ytCanPlay = true" @play="fadeIn" @pause="ytIsplaying = false" @ended="ytIsplaying = false" hidden>
				Your browser does not support the audio element.
			</audio>
		</div>
	</Scroll>
</template>

<style
	lang="scss"
	scoped
>

.show-sm {
	display: none;
}

@media screen and (max-width: 800px) {
	.hide-md {
		display: none;
	}
	.show-sm {
		display: block;
	}

	.title {
		font-size: 1.5em;
	}
}

.cinema-page {
	display: flex;
	flex-direction: column;
	gap: 30px;
}

.top-wrapper {
	display: flex;
	align-items: end;
	gap: 20px;
}

.poster-wrapper {
	width: min(225px, 30vw);
	min-width: min(225px, 30vw);
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
