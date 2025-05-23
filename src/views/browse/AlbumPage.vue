<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore, type WatchProgress } from '@/stores/watchProgress.store';

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
	return `${hours > 0 ? hours + ':' : ''}${minutes > 0 ? String(minutes).padStart(2, '0') : '00'}:${String(secondsOver).padStart(2, '0')}`.trim();
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

const isBook = computed(() => props.libraryItem?.genre === 'Audiobook');
const totalTime = computed(() => props.libraryItem?.tracks.reduce((acc: number, track: any) => acc + track.duration, 0) || 0);

function playTrack(track: any, time: number = 0) {
	if (currentTrack.value === track && !time) {
		return;
	}
	currentTrack.value = track;
	if (audio.value) {
		audio.value.src = useApiStore().apiUrl + '/stream?src=' + track.relativePath;
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

			navigator.mediaSession.setActionHandler('previoustrack', backTrack);
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

type Bookmark = WatchProgress & {
	name: string;
	trackIndex: number;
	isAuto?: boolean;
	sub: NonNullable<WatchProgress['sub']>;
}

const LOCAL_BOOKMARK_NAME = 'This device';
const LATEST_BOOKMARK_NAME = 'Latest';

const bookmarks = computed<Bookmark[]>(() => {
	const allBookmarks = props.libraryItem.watchProgress?.bookmarks.slice() || [];
	const localBookmark = useWatchProgressStore().getLocalProgress(props.libraryItem.relativePath);
	if (props.libraryItem.watchProgress) {
		const latestBookmark = {
			name: LATEST_BOOKMARK_NAME,
			isAuto: true,
			...props.libraryItem.watchProgress,
		};
		allBookmarks.push(latestBookmark);
	}
	if (localBookmark && localBookmark.time !== props.libraryItem.watchProgress?.time) {
		localBookmark.name = LOCAL_BOOKMARK_NAME;
		localBookmark.isAuto = true;
		allBookmarks.push(localBookmark);
	}
	return allBookmarks.map(b => ({
		...b,
		trackIndex: props.libraryItem.tracks.findIndex((track: any) => track.relativePath === b.sub.relativePath),
	})) || [];
});

function timeOffset(trackIndex, timeIntoTrack: number) {
	const track = props.libraryItem.tracks[trackIndex];
	if (!track) {
		return '';
	}
	return timeIntoTrack + track.startOffset;
}

function bookmarkTime(bookmarkName: string) {
	const bookmark = bookmarks.value.find((bookmark: any) => bookmark.name === bookmarkName);
	if (!bookmark) {
		return '';
	}
	return formatRuntime(timeOffset(bookmark.trackIndex, bookmark.sub.time));
}

const bookmarkMenuItems = computed(() => {
	const items = bookmarks.value.map((bookmark) => {
		return {
			isCurrent: currentBookmarkName.value === bookmark.name,
			isAuto: bookmark.isAuto,
			bookmarkName: bookmark.name,
			canDelete: !bookmark.isAuto,
			command: () => {
				if (bookmark.isAuto) {
					setBookmark('');
					playAtBookmark(bookmark.name);
					return;
				}
				if (bookmark.name === currentBookmarkName.value) {
					if (!confirm(`Are you sure you want to stop using bookmark '${bookmark.name}'?`)) {
						return;
					}
					setBookmark('');
					return;
				}
				else {
					setBookmark(bookmark.name);
					playAtBookmark(bookmark.name);
				}
			},
		};
	}) as any[];

	items.push({
		label: 'New bookmark...',
		command: addNewBookmark,
	})
	return items;
});

const bookmarkKey = computed(() => props.libraryItem?.relativePath + '_activeBookmark')
const currentBookmarkName = ref<string>(localStorage.getItem(bookmarkKey.value) || '');

function addNewBookmark() {
	const newName = prompt('Enter a name for the bookmark');
	if (!newName) {
		return;
	}
	const progress = getCurrentProgress() || lastWatched.value;
	props.libraryItem.watchProgress?.bookmarks.push({
		...progress,
		name: newName,
		relativePath: props.libraryItem.relativePath,
	});
	setBookmark(newName);
	postProgress(progress);
}

async function deleteBookmark(name: string) {
	if (!confirm(`Are you sure you want to delete bookmark '${name}'?`)) {
		return;
	}
	if (currentBookmarkName.value === name) {
		setBookmark('');
	}
	props.libraryItem.watchProgress.bookmarks = props.libraryItem.watchProgress.bookmarks.filter((bookmark: any) => bookmark.name !== name);
	await useWatchProgressStore().deleteBookmark(props.libraryItem.relativePath, name);
}

function setBookmark(name: string) {
	if (currentBookmarkName.value === name) {
		return;
	}
	currentBookmarkName.value = name;
	localStorage.setItem(bookmarkKey.value, name);
}

function getBookmark(name: string) {
	const bookmark = bookmarks.value.find((bookmark: any) => bookmark.name === name);
	if (!bookmark) {
		return null;
	}
	return bookmark;
}

function playAtBookmark(bookmarkName: string) {
	const bookmark = getBookmark(bookmarkName);
	if (!bookmark) {
		return;
	}
	playAtTrackTime(bookmark.trackIndex, bookmark.sub.time);
}

function playAtTrackTime(trackIndex: number, time: number) {
	if (!audio.value) {
		return;
	}
	const track = props.libraryItem.tracks[trackIndex];
	if (!track) {
		return;
	}
	playTrack(track, time);
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

function getCurrentProgress() {
	if (!audio.value || !currentTrack.value) {
		return;
	}
	const currentTrackIndex = props.libraryItem.tracks.findIndex((track: any) => track.relativePath === currentTrack.value.relativePath);
	return useWatchProgressStore().createProgress(
		timeOffset(currentTrackIndex, audio.value.currentTime),
		totalTime.value,
		{
			relativePath: currentTrack.value.relativePath,
			time: audio.value.currentTime,
			duration: currentTrack.value.duration,
		}
	);
}

async function postProgress(progress = getCurrentProgress()) {
	if (!isBook.value) {
		return;
	}
	try {
		if (!progress) {
			return;
		}	
		await useWatchProgressStore().postProgress(
			props.libraryItem.relativePath,
			progress,
			currentBookmarkName.value,
			true,
		);
		// update local bookmark
		if (currentBookmarkName.value) {
			const bookmark = getBookmark(currentBookmarkName.value);
			if (bookmark) {
				bookmark.time = progress.time;
				bookmark.duration = progress.duration;
				bookmark.watchedAt = progress.watchedAt;
			}
		}
	}
	catch (e) {
		console.error("Failed to update progress")
		console.error(e);
	}
}

const lastWatched = computed<Bookmark>(() => {
	if (currentBookmarkName.value) {
		const bookmark = getBookmark(currentBookmarkName.value);
		if (bookmark) {
			return bookmark;
		}
	}
	const localProgress = useWatchProgressStore().getLocalProgress(props.libraryItem.relativePath);
	if (localProgress) {
		return {
			...localProgress,
			trackIndex: props.libraryItem.tracks.findIndex((track: any) => track.relativePath === localProgress.sub.relativePath),
		};
	}
	if (!props.libraryItem?.watchProgress) {
		return null;
	}
	const lastWatchedIndex = props.libraryItem.tracks.findIndex((track: any) => track.relativePath === props.libraryItem.watchProgress.sub.relativePath);
	return {
		...props.libraryItem.watchProgress,
		trackIndex: lastWatchedIndex,
	};
})

</script>

<template>
	<div class="album-page">
		<div class="top-wrapper my-3">
			<div class="poster-wrapper">
				<MediaCard
					:imageUrl="libraryItem?.cover"
					:aspectRatio="'square'"
					:progress="(isBook) && (lastWatched || libraryItem?.watchProgress)"
				/>
			</div>
			<div>
				<h3 class="mb-2">{{ libraryItem.title }}</h3>
				<div class="flex align-items-center justify-content-center gap-2">
					<span>{{ libraryItem.artist }}</span>
					-
					<span>{{ formatRuntime(totalTime) }}</span>
				</div>
			</div>
		</div>
		<div class="other-wrapper">
			<div class="controls px-2 flex align-items-center">
				<div class="audio-controls flex-grow-1">
					<audio v-show="currentTrack" ref="audio" :src="useApiStore().apiUrl + '/stream?src=' + libraryItem?.tracks[0]?.relativePath" preload="auto" controls />
					<Button
						v-if="!currentTrack && lastWatched && isBook"
						icon="pi pi-play"
						:label="`Resume ${formatRuntime(timeOffset(lastWatched.trackIndex, lastWatched.sub.time))}`"
						size="large"
						class="w-full"
						@click="() => playAtTrackTime(lastWatched.trackIndex, lastWatched.sub.time)"
					/>
					<Button
						v-else-if="!currentTrack && !lastWatched"
						icon="pi pi-play"
						:label="`Play All`"
						size="large"
						class="w-full"
						@click="() => playTrack(libraryItem?.tracks[0])"
					/>
				</div>
				<div v-if="isBook">
					<DropdownMenu
						:model="bookmarkMenuItems"
					>
						<Button
							:icon="`pi pi-bookmark${(currentBookmarkName === '') ? '' : '-fill'}`"
							size="large"
							text
							severity="contrast"
						/>
						<template #item="{ item }">
							<div class="p-tieredmenu-item-link gap-3" :style="item.isCurrent ? { backgroundColor: 'var(--p-tieredmenu-item-focus-background)', fontWeight: 'bold' } : undefined">
								<span style="white-space: nowrap;">
									<template v-if="item.bookmarkName">
										{{ item.bookmarkName }}
										<span class="text-muted">&nbsp;{{ bookmarkTime(item.bookmarkName) }}</span>
									</template>
									<template v-else>
										{{ item.label }}
									</template>
								</span>
								<div class="flex-grow-1" />
								<i v-if="item.canDelete" @click.stop="() => deleteBookmark(item.bookmarkName)" class="pi pi-trash" />
							</div>
						</template>
					</DropdownMenu>
				</div>
			</div>
			<div class="tracks-list-wrapper" v-if="libraryItem?.tracks">
				<Scroll>
					<div class="tracks-list">
						<div
							class="track-item"
							:class="{ 'active': currentTrack ? track === currentTrack : index === lastWatched?.trackIndex }"
							v-for="(track, index) in libraryItem.tracks"
							:key="index"
							@click="() => playTrack(track)"
						>
							<div><i :class="`pi pi-${track === currentTrack ? 'volume-up' : 'play'}`" /></div>
							<div class="number">{{ index + 1 }}</div>
							<div class="title">{{ track.title }}</div>
							<div class="duration">{{ formatRuntime(isBook ? track.startOffset : track.duration) }}</div>
						</div>
					</div>
					<br />
				</Scroll>
			</div>
		</div>
	</div>
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
	width: min(100%, 13rem);
	min-width: min(100%, 13rem);
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
