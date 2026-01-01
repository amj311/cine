<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import LibraryItemActions from '@/components/LibraryItemActions.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
	directory?: any,
}>();
const backgroundStore = useBackgroundStore();


onBeforeMount(() => {
	backgroundStore.setBackgroundUrl(props.libraryItem.cover_thumb);
	backgroundStore.setPosterUrl(props.libraryItem.cover_thumb, { shape: 'square' });
})

onBeforeUnmount(() => {
	backgroundStore.clearBackgroundUrl();
	backgroundStore.clearPosterUrl();
});

function formatRuntime(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secondsOver = Math.floor(seconds % 60);
	return `${hours > 0 ? hours + ':' : ''}${minutes > 0 ? String(minutes).padStart(2, '0') : '00'}:${String(secondsOver).padStart(2, '0')}`.trim();
}

const audio = ref<HTMLAudioElement | null>(null);
const currentTrack = ref<any>(null);

onMounted(() => {
	if (audio.value) {
		audio.value.addEventListener('ended', playNextTrack);
	}
})

const totalTime = computed(() => props.libraryItem?.tracks.reduce((acc: number, track: any) => acc + track.duration, 0) || 0);

async function playTrack(track: any, time: number = 0) {
	if (currentTrack.value === track && !time) {
		return;
	}
	currentTrack.value = track;
	if (audio.value) {
		audio.value.src = useApiStore().apiUrl + '/stream?src=' + track.relativePath;
		await audio.value.play();
		audio.value.currentTime = time;

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

			navigator.mediaSession.setActionHandler('previoustrack', backTrack);
			navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
			navigator.mediaSession.setActionHandler('play', async () => {
				await audio.value?.play();
			});
			navigator.mediaSession.setActionHandler('pause', async () => {
				await audio.value?.pause();
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

function backTrack() {
	if (!currentTrack.value || !audio.value) {
		return;
	}
	if (audio.value.currentTime > 5) {
		audio.value.currentTime = 0;
		return;
	}
	const tracks = props.libraryItem.tracks;
	const currentIndex = tracks.findIndex((track: any) => track.relativePath === currentTrack.value.relativePath);
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
	const currentIndex = tracks.findIndex((track: any) => track.relativePath === currentTrack.value.relativePath);
	if (currentIndex < 0 || currentIndex >= tracks.length - 1) {
		return;
	}
	const nextTrack = tracks[currentIndex + 1];
	playTrack(nextTrack);
}


const libraryItemActions = ref<InstanceType<typeof LibraryItemActions>>();
</script>

<template>
	<div class="album-page">
		<div class="top-wrapper my-3">
			<div class="poster-wrapper">
				<MediaCard
					:imageUrl="libraryItem?.cover"
					:aspectRatio="'square'"
				/>
			</div>
			<div class="flex flex-column align-items-center gap-2">
				<div class="flex align-items-center gap-2">
					<h3>{{ libraryItem.title }}</h3>
					<LibraryItemActions ref="libraryItemActions" :libraryItem="libraryItem" />
				</div>
				<div class="flex align-items-center justify-content-center gap-2">
					<span v-if="libraryItem.artist">{{ libraryItem.artist }}&nbsp;-&nbsp;</span>
					<span v-if="libraryItem.year">{{ libraryItem.year }}&nbsp;-&nbsp;</span>
					<span>{{ formatRuntime(totalTime) }}</span>
				</div>
			</div>
		</div>
		<div class="other-wrapper">
			<div class="controls px-2 flex align-items-center">
				<div class="audio-controls flex-grow-1">
					<audio v-show="currentTrack" ref="audio" :src="useApiStore().apiUrl + '/stream?src=' + libraryItem?.tracks[0]?.relativePath" preload="auto" controls />
					<Button
						v-if="!currentTrack"
						icon="pi pi-play"
						:label="`Play All`"
						size="large"
						class="w-full"
						@click="() => playTrack(libraryItem?.tracks[0])"
					/>
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
							<div class="number">{{ Number(index) + 1 }}</div>
							<div class="title">{{ track.title }}</div>
							<div class="duration">{{ formatRuntime(track.duration) }}</div>
						</div>
					</div>
					<br />
				</Scroll>
			</div>
		</div>
	</div>

	<LibraryItemActions ref="libraryItemActions" :libraryItem="libraryItem" />
</template>

<style
	lang="scss"
	scoped
>
.album-page {
	display: flex;
	flex-direction: column;
	gap: 1em;
	height: 100%;
	min-height: 0;
	max-height: 100%;
	overflow: hidden;

	.top-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1em;
   		padding: 0 2em;
    	flex: 1 0 10vw;
	}

	.other-wrapper {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 1em;
		height: 100%;
		max-height: 100%;
		min-height: 0;
	}
}

/* landscape screens */
@media (min-aspect-ratio: 1/1) {
	.album-page {
		flex-direction: row;
		align-items: center;
		padding-left: 1rem;
	}
}


.poster-wrapper {
	width: min(100%, 20rem);
}

.tracks-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.track-item {
	font-size: 1.2rem;
	display: grid;
	grid-template-columns: 1em 1em 1fr auto;
	align-items: center;
	gap: .5rem;
	padding: 0.8em 0.7em;
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
