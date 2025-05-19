<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore } from '@/stores/watchProgress.store';

const props = defineProps<{
	libraryItem: any; // libraryItem
}>();
const backgroundStore = useBackgroundStore();


onBeforeMount(() => {
	backgroundStore.setBackgroundUrl(props.libraryItem.cover_thumb);
	backgroundStore.setPosterUrl(props.libraryItem.cover_thumb);
})

onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
	backgroundStore.clearPosterUrl();
});

function formatRuntime(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secondsOver = Math.floor(seconds % 60);
	return `${hours > 0 ? hours + ':' : ''}${minutes > 0 ? minutes + '' : '00'}:${secondsOver > 0 ? secondsOver + '' : ''}`.trim();
}

const audio = ref<HTMLAudioElement | null>(null);
const currentTrack = ref<any>(null);

onMounted(() => {
	if (audio.value) {
		audio.value.addEventListener('ended', playNextTrack);
		audio.value.addEventListener('play', startProgressUpdate);
		audio.value.addEventListener('pause', stopProgressUpdate);
	}
})

onBeforeUnmount(() => {
	stopProgressUpdate();
});


function playTrack(track: any, time: number = 0) {
	if (currentTrack.value === track) {
		return;
	}
	currentTrack.value = track;
	if (audio.value) {
		audio.value.src = useApiStore().baseUrl + '/stream?src=' + track.relativePath;
		audio.value.play();
		audio.value.currentTime = time;
		startProgressUpdate();

		// set device media image
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currentTrack.value.title,
				artist: currentTrack.value.artist,
				album: currentTrack.value.album,
				artwork: [
					{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '512x512', type: 'image/png' },
					{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '256x256', type: 'image/png' },
					{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '96x96', type: 'image/png' }
				],
			});

			navigator.mediaSession.setActionHandler('previoustrack', playPreviousTrack);
			navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
			navigator.mediaSession.setActionHandler('play', () => {
				audio.value?.play();
			});
			navigator.mediaSession.setActionHandler('pause', () => {
				audio.value?.pause();
			});
			// seek
			navigator.mediaSession.setActionHandler('seekbackward', (details) => {
				if (audio.value) {
					audio.value.currentTime = Math.max(0, audio.value.currentTime - (details.seekOffset || 10));
				}
			});
			navigator.mediaSession.setActionHandler('seekforward', (details) => {
				if (audio.value) {
					audio.value.currentTime = Math.min(audio.value.duration, audio.value.currentTime + (details.seekOffset || 10));
				}
			});
		}
	}
}

function playPreviousTrack() {
	if (!currentTrack.value) {
		return;
	}
	const tracks = props.libraryItem.tracks;
	const currentIndex = tracks.findIndex((track: any) => track.trackNumber === currentTrack.value.trackNumber);
	if (currentIndex <= 0) {
		return;
	}
	const previousTrack = tracks[currentIndex - 1];
	playTrack(previousTrack);
}

function playNextTrack() {
	if (!currentTrack.value) {
		return;
	}
	const tracks = props.libraryItem.tracks;
	const currentIndex = tracks.findIndex((track: any) => track.trackNumber === currentTrack.value.trackNumber);
	if (currentIndex < 0 || currentIndex >= tracks.length - 1) {
		return;
	}
	const nextTrack = tracks[currentIndex + 1];
	playTrack(nextTrack);
}

const PROGRESS_INTERVAL = 1000 * 5;
let progressUpdateInterval;

function startProgressUpdate() {
	if (progressUpdateInterval) {
		return;
	}
	progressUpdateInterval = setInterval(() => {
		postProgress();
	}, PROGRESS_INTERVAL);
}

function stopProgressUpdate() {
	if (progressUpdateInterval) {
		clearInterval(progressUpdateInterval);
		progressUpdateInterval = null;
	}
}

async function postProgress() {
	try {
		if (!audio.value) {
			return;
		}
		await useWatchProgressStore().postprogress(
			currentTrack.value.relativePath,
			useWatchProgressStore().createProgress(audio.value.currentTime, audio.value.duration)
		);
	}
	catch (e) {
		console.error("Failed to update progress")
		console.error(e);
	}
}

const lastWatchedtrack = computed(() => {
	const tracks = props.libraryItem?.tracks || [];
	const watchedTracks = tracks.filter((track: any) => track.watchProgress);
	const lastWatched = watchedTracks.slice().sort((a: any, b: any) => b.watchProgress.watchedAt - a.watchProgress.watchedAt)[0];
	if (!lastWatched) {
		return null;
	}
	const lastWatchedIndex = tracks.findIndex((track: any) => track.trackNumber === lastWatched.trackNumber);
	if (lastWatchedIndex === tracks.length - 1 && lastWatched.watchProgress.time >= lastWatched.watchProgress.duration) {
		return null;
	}
	return lastWatched;
})

</script>

<template>
	<Scroll>
		<div class="series-page">
			<div class="top-wrapper">
				<div class="poster-wrapper">
					<MediaCard
						:imageUrl="libraryItem?.cover_thumb"
						:aspectRatio="'square'"
						:progress="libraryItem?.watchProgress"
					/>
				</div>
				<div class="my-3">
					<h3>{{ libraryItem.title }}</h3>
					<div>{{ libraryItem.artist }}</div>
				</div>
			</div>
			<div class="tracks-list-wrapper" v-if="libraryItem?.tracks">
				<Scroll>
					<div class="tracks-list">
						<div
							class="track-item"
							:class="{ 'active': track === currentTrack }"
							v-for="(track, index) in libraryItem.tracks"
							:key="index"
							@click="() => playTrack(track)"
						>
							<div><i :class="`pi pi-${track === currentTrack ? 'volume-up' : 'play'}`" /></div>
							<div class="number">{{ track.trackNumber }}</div>
							<div class="title">{{ track.title }}</div>
							<div class="duration">{{ formatRuntime(track.duration) }}</div>
						</div>
					</div>
				</Scroll>
			</div>
			<div class="audio-controls px-2 pb-3">
				<audio v-show="currentTrack" ref="audio" :src="useApiStore().baseUrl + '/stream?src=' + libraryItem?.tracks[0]?.relativePath" preload="auto" controls />
				<Button
					v-if="!currentTrack && lastWatchedtrack"
					icon="pi pi-play"
					:label="`Resume (#${lastWatchedtrack.trackNumber}, ${formatRuntime(lastWatchedtrack.watchProgress.time)})`"
					size="large"
					class="w-full"
					@click="() => playTrack(lastWatchedtrack, lastWatchedtrack.watchProgress.time)"
				/>
				<Button
					v-if="!currentTrack && !lastWatchedtrack"
					icon="pi pi-play"
					:label="`Play All`"
					size="large"
					class="w-full"
					@click="() => playTrack(libraryItem?.tracks[0])"
				/>
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
	gap: 1em;
	height: 100%;
	min-height: 0;
	max-height: 100%;
	overflow: hidden;
}

.top-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.poster-wrapper {
	width: min(100%, 15rem);
	min-width: min(100%, 15rem);
}

.tracks-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.track-item {
	display: grid;
	grid-template-columns: 1em 1em 1fr auto;
	align-items: center;
	gap: .5rem;
	padding: 0.5rem 0.7rem;
	cursor: pointer;

	
	&.active {
		background-color: #fff1;
		.title { font-weight: bold; }
	}
	&:hover {
		background-color: #fff2;
	}

	.number {
		text-align: right;
		opacity: .7;
	}

	.title {
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.duration {
		text-align: right;
		opacity: .7;
	}
}

.audio-controls {
	audio {
		width: 100%;
	}
}
</style>
