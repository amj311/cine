<script
	setup
	lang="ts"
>
import { useRouter } from 'vue-router';
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';

const props = defineProps<{
	libraryItem: any; // libraryItem
	directory: { folders: { folderName: string; libraryItem }[]; files: string[] } | null;
}>();
const backgroundStore = useBackgroundStore();

const metadata = ref<any>(null);
const isLoadingMetadata = ref(false);

// async function loadMetadata() {
// 	try {
// 		isLoadingMetadata.value = true;
// 		metadata.value = await MetadataService.getMetadata(props.libraryItem, true);
// 		if (metadata.value) {
// 			backgroundStore.setBackgroundUrl(metadata.value.background);
// 			backgroundStore.setPosterUrl(metadata.value.background);
// 		}
// 	} catch (error) {
// 		console.error('Error loading metadata', error);
// 	} finally {
// 		isLoadingMetadata.value = false;
// 	}
// }

// loadMetadata();

onBeforeMount(() => {
	backgroundStore.setBackgroundUrl(props.libraryItem.cover_thumb);
	backgroundStore.setPosterUrl(props.libraryItem.cover_thumb);
})

onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
	backgroundStore.clearPosterUrl();
});

// function playVideo(path: string, startTime?: number) {
// 	router.push({
// 		name: 'play',
// 		query: {
// 			path,
// 			startTime,
// 		},
// 	})
// }

// function formatRuntime(minutes: number) {
// 	const hours = Math.floor(minutes / 60);
// 	const minutesOver = minutes % 60;
// 	if (hours === 0) {
// 		return `${minutesOver}min`;
// 	}
// 	return `${hours}hr ${minutesOver}min`;
// }


// // Combine libraryItem.season with matching metadata from metadata.seasons
// const activeSeason = ref(metadata.value?.seasons[0] || null);

// const mergedSeasons = computed(() => {
// 	const seasons = props.libraryItem.seasons.map((season: any) => {
// 		const metadataSeason = metadata.value?.seasons.find((s: any) => s.seasonNumber === season.seasonNumber);
// 		return {
// 			...season,
// 			...metadataSeason,
// 			name: season.seasonNumber === 0 ? 'Specials' : season.name,
// 			tracks: season.trackFiles.flatMap((file: any) => file.tracks).map(track => {
// 				const metadatatrack = metadataSeason?.tracks.find((e: any) => e.trackNumber === track.trackNumber);
// 				return {
// 					...track,
// 					...metadatatrack,
// 				};
// 			}),
// 		};
// 	});
// 	// Sort seasons by season number bu put specials last
// 	seasons.sort((a: any, b: any) => {
// 		if (a.seasonNumber === 0) {
// 			return 1;
// 		}
// 		if (b.seasonNumber === 0) {
// 			return -1;
// 		}
// 		return a.seasonNumber - b.seasonNumber;
// 	});
// 	return seasons;
// });

// const trackToPlay = ref<any>(null);

// watch(() => mergedSeasons.value, determinetrackToPlay, { immediate: true, deep: true });

// function determinetrackToPlay() {
// 	// Find the track with the most recent watch time
// 	const scored = mergedSeasons.value.flatMap((season: any) => season.tracks).map((track: any) => {
// 		let score = 0;
// 		if (!track.watchProgress) {
// 			score = 0;
// 		}
// 		else if (track.watchProgress.percentage >= 90) {
// 			score = 0;
// 		}
// 		else {
// 			score = track.watchProgress?.watchedAt
// 		}
// 		return {
// 			...track,
// 			score,
// 		};
// 	}).filter((track: any) => track.score > 0).reverse();
// 	const track = scored[0] || mergedSeasons.value[0].tracks[0];

// 	// Use this opportunity to update the active season based on the last watched track
// 	activeSeason.value =
// 		mergedSeasons.value.find((season: any) => season.seasonNumber === track.seasonNumber)
// 		// Or select the first season that is not specials
// 		|| mergedSeasons.value.find((season: any) => season.seasonNumber !== 0)
// 		|| mergedSeasons.value[0];

// 	trackToPlay.value = track;
// };

// const resumeTime = computed(() => {
// 	if (trackToPlay.value?.watchProgress?.percentage < 90) {
// 		return trackToPlay.value?.watchProgress.time;
// 	}
// 	return 0;
// });


// watch(
// 	() => useWatchProgressStore().lastWatchProgress,
// 	(lastProgress) => {
// 		// find matching track in mergedSeasons
// 		const track = mergedSeasons.value.flatMap((season: any) => season.tracks).find((track: any) => track.relativePath === lastProgress?.relativePath);
// 		if (track) {
// 			track.watchProgress = lastProgress.progress;
// 			trackToPlay.value = track;
// 		}
// 	}
// )


</script>

<template>
	<Scroll>
		<div class="series-page pl-3 pr-2">
			<div class="top-wrapper">
				<div class="poster-wrapper">
					<MediaCard
						:imageUrl="libraryItem?.cover_thumb"
						:aspectRatio="'square'"
						:progress="libraryItem?.watchProgress"
					/>
				</div>
				<h3>{{ libraryItem.title }}</h3>
				<div>{{ libraryItem.artist }}</div>
			</div>
			<div class="tracks-list-wrapper" v-if="directory?.files">
				<Scroll>
					<div class="tracks-list">
						<div class="track-item" v-for="(file, index) in directory.files" :key="index">
							<div>{{ file }}</div>
							<audio controls>
								<source :src="useApiStore().baseUrl + '/stream?src=' + libraryItem.relativePath + '/' + file" type="audio/mpeg" />
							</audio>
						</div>
					</div>
				</Scroll>
			</div>
		</div>
	</Scroll>
</template>

<style
	lang="scss"
	scoped
>
.series-page {
	display: flex;
	flex-direction: column;
	gap: 30px;
	height: 100%;
	min-height: 0;
	max-height: 100%;
	overflow: hidden;
}

.top-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
}

.poster-wrapper {
	width: min(100%, 20rem);
	min-width: min(100%, 20rem);
}

.tracks-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.track-item {
	audio {
		width: 100%;
	}
}
</style>
