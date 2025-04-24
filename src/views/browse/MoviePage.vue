<script
	setup
	lang="ts"
>
import { useRouter } from 'vue-router';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useBackgroundStore } from '@/stores/background.store';
import ExtrasList from '@/components/ExtrasList.vue';

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


onBeforeMount(() => {
	loadMetadata();
});
onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
	backgroundStore.clearPosterUrl();
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
	const minutesOver = Math.floor(minutes % 60);
	if (hours === 0) {
		return `${minutesOver}min`;
	}
	return `${hours}hr ${minutesOver}min`;
}

const resumeTime = computed(() => {
	if (props.libraryItem.movie.watchProgress?.percentage < 90) {
		return props.libraryItem.movie.watchProgress.time;
	}
	return 0;
});

</script>

<template>
	<div class="movie-page">
		<div class="top-wrapper">
			<div>
				<div class="poster-wrapper">
					<MediaCard
						:imageUrl="metadata?.poster_full"
						:progress="libraryItem.movie.watchProgress"
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
				<StarRating v-if="!isNaN(metadata?.rating)" :rating="metadata.rating" :votes="metadata.votes" />

				<br />
				<Button
					:size="'large'"
					class="play-button"
					@click="() => playVideo(libraryItem.movie.relativePath, resumeTime)"
				>
					<i class="pi pi-play" />
					{{ resumeTime ? `Resume (${formatRuntime(resumeTime / 60)})` : 'Play' }}
				</Button>
				<Button
					v-if="resumeTime"
					:size="'large'"
					variant="text"
					severity="contrast"
					@click="() => playVideo(libraryItem.movie.relativePath, 0)"
				>
					<i class="pi pi-replay" />
				</Button>

				<div class="hide-md" style="max-width: 50em;">
					<br />
					<p class="line-clamp-4">{{ metadata?.overview }}</p>
					<span v-if="metadata?.genres.length">Genres: <i>{{ metadata?.genres.join(', ') }}</i></span>
				</div>
			</div>
		</div>
	
		<div class="show-lg">
			<p>{{ metadata?.overview }}</p>
			<span v-if="metadata?.genres.length">Genres: <i>{{ metadata?.genres.join(', ') }}</i></span>
		</div>

		<div v-if="metadata?.credits">
			<h2>Cast & Crew</h2>
			<PeopleList :people="metadata.credits" />
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
		display: block;
	}
}

@media screen and (max-width: 600px) {
	.hide-sm {
		display: none;
	}
	.title {
		font-size: 1.5em;
	}
}

.movie-page {
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

</style>
