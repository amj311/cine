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

</script>

<template>
	<div class="movie-page">
		<div class="top-wrapper">
			<div>
			<div class="poster-wrapper">
				<MediaCard
					:imageUrl="metadata?.poster_full"
					:progress="libraryItem.movie.watchProgress?.percentage"
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

				<Button
					:size="'large'"
					class="play-button"
					@click="() => playVideo(libraryItem.movie.relativePath)"
				>
					Play
				</Button>

				<p class="hide-md" style="max-width: 50em;"><br /><br />{{ metadata?.overview }}</p>
			</div>
		</div>
	
		<p class="show-lg">{{ metadata?.overview }}</p>


		<div v-if="metadata?.credits">
			<h2>Cast & Crew</h2>
			<PeopleList :people="metadata.credits" />
		</div>

		<div v-if="libraryItem.extras?.length > 0">	
			<h2>Extras</h2>
			<div class="hide-scrollbar">
				<div class="extras-list">
					<div class="extra-item" v-for="extra in libraryItem.extras" :key="extra.relativePath">
						<div class="extra-poster-wrapper">
							<MediaCard
								:fallbackIcon="'🎬'"
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
	width: min(300px, 30vw);
	min-width: min(300px, 30vw);
}

.extras-list, .credits-list {
	display: flex;
	gap: 20px;
	padding: 10px;
	width: 100%;
	overflow-x: auto;
	white-space: nowrap;
}

.extra-poster-wrapper {
	width: min(250px, 30vw);
}

.credits-item {
	display: flex;
	flex-direction: column;
	align-items: center;

	.image-wrapper {
		width: 100px;
		height: 100px;
		background-color: var(--color-background-mute);
		background-size: cover;
		background-position: center;
		border-radius: 50%;
		margin-bottom: 5px;
	}
}
</style>
