<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore, type Bookmark, type WatchProgress } from '@/stores/watchProgress.store';
import type SurpriseModal from '@/components/SurpriseModal.vue';
import type LibraryItemActions from '@/components/LibraryItemActions.vue';
import { v4 } from 'uuid';

type Track = {
	relativePath: string,
	duration: number,
	watchProgress?: WatchProgress,
	titleStartOffset: number,
}

type Chapter = {
	id: number,
	relativePath: string,
	title: string,
	start_s: number,
	end_s: number,
	trackDuration: number,
	duration: number,
	titleStartOffset: number,
	discNumber?: number,
	trackNumber?: number,
}

const props = defineProps<{
	libraryItem: { [key: string]: any } & { chapters: Array<Chapter>, tracks: Array<Track>, bookmarks: Record<string, Bookmark>}; // libraryItem
}>();
const backgroundStore = useBackgroundStore();

const currentProgress = ref<WatchProgress>(props.libraryItem.watchProgress || { relativePath: props.libraryItem.relativePath, bookmarks: [] });

onBeforeMount(() => {
	backgroundStore.setBackgroundUrl(props.libraryItem.cover_thumb);
	backgroundStore.setPosterUrl(props.libraryItem.cover_thumb, { shape: 'square' });
	computeBookmarks();
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

const audioRef = ref<HTMLAudioElement | null>(null);
const currentChapterIdx = ref<number | null>(null);
const currentChapter = computed(() => props.libraryItem.chapters[currentChapterIdx.value || -1]);
const playingTrack = ref<{
	relativePath: string;
	duration: number;
} | null>(null);


// const playingState = ref({
// 	paused: false,
// 	ended: false,
// 	currentTime: 0,
// 	progress_pct: 0,
// 	duration_s: 0,
// });


// function updatePlayingState() {
// 	if (!audioRef.value) {
// 		return;
// 	}
// 	playingState.value.paused = audioRef.value.paused;
// 	playingState.value.ended = audioRef.value.ended;
// 	playingState.value.currentTime = audioRef.value.currentTime;
// 	playingState.value.progress_pct = audioRef.value.duration ? audioRef.value.currentTime * 100 / audioRef.value.duration : 0;
// }

// function loopUpdateState() {
// 	window.requestAnimationFrame(() => {
// 		updatePlayingState();
// 		loopUpdateState();
// 	})
// }

onMounted(() => {
	if (audioRef.value) {
		audioRef.value.addEventListener('ended', playNextChapter);
		audioRef.value.addEventListener('play', startProgressUpdate);
		audioRef.value.addEventListener('pause', stopProgressUpdate);
	}
})

onBeforeUnmount(() => {
	stopProgressUpdate();
});

const isM4b = computed(() => true);
const totalTime = computed(() => isM4b.value ? props.libraryItem?.chapters[0]?.trackDuration : props.libraryItem?.chapters.reduce((acc: number, chapter: any) => acc + chapter.duration, 0));

async function playChapter(chapter: Chapter, time: number = chapter.start_s || 0) {
	if (!audioRef.value) {
		return;
	}
	
	currentChapterIdx.value = props.libraryItem.chapters.findIndex(c => c === chapter);

	// CURRENT CHAPTER REF WILL UPDATE HERE
	if (!currentChapter.value) {
		throw new Error("Could not find chapter");
	}

	playingTrack.value = {
		relativePath: currentChapter.value.relativePath,
		duration: currentChapter.value.trackDuration,
	}

	audioRef.value.src = useApiStore().apiUrl + ('/stream?path=') + playingTrack.value!.relativePath;
	await audioRef.value.play();
	audioRef.value.currentTime = time ?? currentChapter.value.start_s;
	startProgressUpdate();

	// set device media image
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: currentChapter.value.title,
			artist: props.libraryItem.author,
			album: props.libraryItem.title,
			artwork: [
				{ src: useApiStore().resolve(props.libraryItem.cover), sizes: '512x512', type: 'image/png' },
				{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '256x256', type: 'image/png' },
				{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '96x96', type: 'image/png' }
			],
		});

		navigator.mediaSession.setActionHandler('previoustrack', backChapter);
		navigator.mediaSession.setActionHandler('nexttrack', playNextChapter);
		navigator.mediaSession.setActionHandler('play', async () => {
			await audioRef.value?.play();
		});
		navigator.mediaSession.setActionHandler('pause', async () => {
			await audioRef.value?.pause();
		});
		// seek
		navigator.mediaSession.setActionHandler('seekbackward', (details) => {
			if (audioRef.value) {
				audioRef.value.currentTime = Math.max(0, audioRef.value.currentTime - (details.seekOffset || 10));
			}
		});
		navigator.mediaSession.setActionHandler('seekforward', (details) => {
			if (audioRef.value) {
				audioRef.value.currentTime = Math.min(audioRef.value.duration, audioRef.value.currentTime + (details.seekOffset || 10));
			}
		});
	}
}

function backChapter() {
	if (!currentChapter.value || !audioRef.value) {
		return;
	}
	if (audioRef.value.currentTime > currentChapter.value.start_s + 5) {
		audioRef.value.currentTime = currentChapter.value.start_s || 0;
		return;
	}
	const chapters = props.libraryItem.chapters;
	const currentIndex = chapters.findIndex((chapter: any) => chapter === currentChapter.value);
	if (currentIndex <= 0) {
		return;
	}
	const previousChapter = chapters[currentIndex - 1];
	playChapter(previousChapter);	
}

function playNextChapter() {
	if (!currentChapter.value) {
		return;
	}
	const chapters = props.libraryItem.chapters;
	const currentIndex = chapters.findIndex((chapter: any) => chapter === currentChapter.value);
	if (currentIndex < 0 || currentIndex >= chapters.length - 1) {
		return;
	}
	const nextChapter = chapters[currentIndex + 1];
	playChapter(nextChapter);
}

const LOCAL_BOOKMARK_ID = 'this_device_bookmark';
const LOCAL_BOOKMARK_NAME = 'This device';
const LATEST_BOOKMARK_ID = 'latest_bookmark';
const LATEST_BOOKMARK_NAME = 'Latest';

const bookmarks = ref<Bookmark[]>([]);
function computeBookmarks() {
	const allBookmarks: Array<Bookmark> = Array.from(Object.values(props.libraryItem.bookmarks)) || [];
	const localBookmark = useWatchProgressStore().getLocalProgress(props.libraryItem.relativePath);

	const latestWatchedTrack = props.libraryItem.tracks.filter(t => t.watchProgress).reduce((latestProgress, track) => track.watchProgress!.time > (latestProgress?.watchProgress!.time || 0) ? track : latestProgress, null as Track | null);

	if (latestWatchedTrack) {
		const latestBookmark = {
			id: LATEST_BOOKMARK_ID,
			name: LATEST_BOOKMARK_NAME,
			isAuto: true,
			titlePath: '',
			...latestWatchedTrack.watchProgress!,
		};
		allBookmarks.push(latestBookmark);
	}
	if (localBookmark && localBookmark.time !== props.libraryItem.watchProgress?.time) {
		localBookmark.id = LOCAL_BOOKMARK_ID;
		localBookmark.name = LOCAL_BOOKMARK_NAME;
		localBookmark.isAuto = true;
		allBookmarks.push(localBookmark);
	}
	bookmarks.value = allBookmarks.map(b => ({
		...b,
		chapterIndex: findChapterIndexAtTime(b.relativePath, b.time),
	})) || [];
};


function findChapterIndexAtTime(relativePath, trackTime) {
	return props.libraryItem.chapters.findIndex((chapter, i) => {
		if (chapter.relativePath !== relativePath) {
			return false;
		}
		if (!props.libraryItem.chapters[i + 1]) {
			return true;
		}
		return trackTime >= chapter.titleStartOffset && trackTime < props.libraryItem.chapters[i + 1].titleStartOffset;
	})
}

function computeTitleOffset(trackPath, timeIntoTrack): number {
	const track = props.libraryItem.tracks.find(t => t.relativePath === trackPath);
	if (!track) {
		return 0;
	}
	return track.titleStartOffset + timeIntoTrack;
}

function bookmarkTime(bookmarkName: string) {
	const bookmark = bookmarks.value.find((bookmark) => bookmark.name === bookmarkName);
	if (!bookmark) {
		return '';
	}
	return formatRuntime(computeTitleOffset(bookmark.relativePath, bookmark.time));
}

const bookmarkMenuItems = computed(() => {
	const items = bookmarks.value.map((bookmark) => {
		return {
			isCurrent: currentBookmarkId.value === bookmark.id,
			isAuto: bookmark.isAuto,
			bookmarkName: bookmark.name,
			canDelete: !bookmark.isAuto,
			command: () => {
				if (bookmark.isAuto) {
					setBookmark('');
					playAtBookmark(bookmark.name);
					return;
				}
				if (bookmark.id === currentBookmarkId.value) {
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
const currentBookmarkId = ref<string>(localStorage.getItem(bookmarkKey.value) || '');
const currentBookmark = computed(() => bookmarks.value.find(b => b.id === currentBookmarkId.value))

function addNewBookmark() {
	const newName = prompt('Enter a name for the bookmark');
	if (!newName) {
		return;
	}
	const progress = getCurrentProgress() || lastWatched.value;
	const newBookmark = {
		...progress,
		id: v4(),
		name: newName,
		titlePath: props.libraryItem.relativePath,
	}
	props.libraryItem.bookmarks[newBookmark.id] = newBookmark;
	computeBookmarks();
	setBookmark(newBookmark.id);
	postProgress(progress);
}

async function deleteBookmark(bookmark: Bookmark) {
	if (!confirm(`Are you sure you want to delete bookmark '${bookmark.name}'?`)) {
		return;
	}
	if (currentBookmarkId.value === bookmark.id) {
		setBookmark('');
	}
	delete props.libraryItem.bookmarks[bookmark.id];
	await useWatchProgressStore().deleteBookmark(props.libraryItem.relativePath, bookmark.id);
	computeBookmarks();
}

function setBookmark(name: string) {
	if (currentBookmarkId.value === name) {
		return;
	}
	currentBookmarkId.value = name;
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
	playTrackAtTime(bookmark.relativePath, bookmark.time);
}

function playTrackAtTime(relativePath: string, time: number) {
	if (!audioRef.value) {
		return;
	}
	const chapter = props.libraryItem.chapters[findChapterIndexAtTime(relativePath, time)];
	if (!chapter) {
		return;
	}
	playChapter(chapter, time);
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
	if (!audioRef.value || !currentChapter.value) {
		return;
	}
	return useWatchProgressStore().createProgress(
		currentChapter.value.relativePath,
		audioRef.value.currentTime,
		currentChapter.value.trackDuration,
	);
}

async function postProgress(progress = getCurrentProgress()) {
	try {
		if (!progress) {
			return;
		}
		currentProgress.value = progress;

		await useWatchProgressStore().postProgress(
			progress.relativePath,
			progress,
			currentBookmark.value ? {
				id: currentBookmarkId!.value,
				name: currentBookmark.value.name,
				titlePath: props.libraryItem.relativePath,
			} : undefined,
			props.libraryItem.relativePath,
		);
		// update local bookmark
		if (currentBookmarkId.value) {
			const bookmark = getBookmark(currentBookmarkId.value);
			if (bookmark) {
				bookmark.time = progress.time;
				bookmark.duration = progress.duration;
				bookmark.watchedAt = progress.watchedAt;
			}
		}

		// check for new chapter
		const index = findChapterIndexAtTime(
			props.libraryItem.relativePath,
			progress.time
		);
		if (index !== -1) {
			const chapter = props.libraryItem.chapters[index];
			if (currentChapter.value !== chapter) {
				playChapter(chapter, audioRef.value!.currentTime);
			}
		}
	}
	catch (e) {
		console.error("Failed to update progress")
		console.error(e);
	}
}

const lastWatched = computed<Bookmark>(() => {
	if (currentBookmarkId.value) {
		const bookmark = getBookmark(currentBookmarkId.value);
		if (bookmark) {
			return bookmark;
		}
	}
	const localProgress = useWatchProgressStore().getLocalProgress(props.libraryItem.relativePath);
	if (localProgress) {
		return {
			...localProgress,
			chapterIndex: findChapterIndexAtTime(
				localProgress.relativePath,
				localProgress.time
			),
		};
	}
})


const imageLoaded = ref(false);
const imageError = ref('');
function loadImage() {
	imageLoaded.value = false;
	imageError.value = '';
	const img = document.createElement('img');
	img.src = useApiStore().resolve(props.libraryItem?.cover);
	img.onerror = () => imageError.value = 'Error';
	img.onload = () => imageLoaded.value = true;
}
watch(() => useApiStore().resolve(props.libraryItem?.cover), loadImage, { immediate: true });

</script>

<template>
	<div class="album-page">
		<div class="top-wrapper my-3">
			<div class="poster-wrapper relative" style="aspect-ratio: 1; user-select: none;">
				<template v-if="imageLoaded">
					<div style="position: absolute; inset: -6% -31% -36% -27%;">
						<img src="@/assets/square-book-3d-trans.png" class="w-full" style="object-fit: contain; width: 100%; height: 100%; user-select: none;" />
					</div>
					<div style="position: absolute; aspect-ratio: 1; top: 0%; right: 9.5%; bottom: -2%; perspective: 1550px;">
						<div
							class="relative overflow-hidden"
							v-if="libraryItem?.cover && !imageError"
							:src="useApiStore().resolve(libraryItem?.cover)"
							style="width: 100%; aspect-ratio: 1; transform: rotateY(-31deg); transform-origin: right center; border-radius: 1% 2% 2% 1%;"
						>
							<img
								class="absolute"
								:src="useApiStore().resolve(libraryItem?.cover)" style="inset: -1px; width: calc(100% + 2px); aspect-ratio: 1;"
								@error="imageError = 'Failed to load cover'"
							/>
							<div class="book-texture absolute" style="inset: 0px; background-image: linear-gradient(to right, transparent 1%, rgba(0, 0, 0, 0.4) 4%, transparent 5%), linear-gradient(to right, transparent 4%, rgba(255, 255, 255, 0.2) 6%, transparent 9%); box-shadow: inset 3px 3px 2px 0px #fff3, inset -4px -2px 2px 0px #0005;" />
						</div>
					</div>
				</template>
				<div v-else class="absolute h-full w-full flex-center-all">
					<i class="pi pi-spin pi-spinner" />
				</div>
			</div>
			<div class="flex flex-column align-items-center gap-2 relative">
				<div class="flex align-items-center gap-2">
					<h3 class="line-clamp-2">{{ libraryItem.title }}</h3>
				</div>
				<div class="flex align-items-center justify-content-center">
					{{ [libraryItem.author, libraryItem.year, formatRuntime(totalTime)].filter(Boolean).join(' - ') }}
				</div>
			</div>

			<div class="controls flex align-items-center w-full">
				<div class="audio-controls flex-grow-1">
					<audio v-show="playingTrack" ref="audioRef" preload="auto" controls crossorigin="use-credentials" />
					<Button
						v-if="!playingTrack && lastWatched"
						icon="pi pi-play"
						:label="`Resume ${formatRuntime(computeTitleOffset(lastWatched.relativePath, lastWatched.time))}`"
						size="large"
						class="w-full"
						@click="() => playTrackAtTime(lastWatched.relativePath, lastWatched.time)"
						data-focus-priority="1"
					/>
					<Button
						v-else-if="!playingTrack && !lastWatched"
						icon="pi pi-play"
						label="Begin"
						size="large"
						class="w-full"
						@click="() => playChapter(libraryItem?.chapters[0])"
						data-focus-priority="1"
					/>
				</div>
				<DropdownMenu
					:model="bookmarkMenuItems"
				>
					<Button
						:icon="`pi pi-bookmark${Boolean(currentBookmark) ? '-fill' : ''}`"
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
				<LibraryItemActions ref="libraryItemActions" :libraryItem="libraryItem" />
			</div>
		</div>
		<div class="other-wrapper">
			<div class="chapters-list-wrapper" v-if="libraryItem?.chapters">
				<Scroll>
					<div class="chapters-list">
						<template
							v-for="(chapter, index) in libraryItem.chapters"
							:key="index"
						>
							<div
								v-if="chapter.discNumber && chapter.discNumber !== libraryItem.chapters[Number(index) - 1]?.discNumber"
								class="p-3 opacity-70"	
							>
								Disc {{ Number(chapter.discNumber) }}
							</div>
							<div
								class="chapter-item bg-blur-hover"
								:class="{ 'active': currentChapter ? chapter === currentChapter : index === findChapterIndexAtTime(lastWatched.relativePath, lastWatched.time) }"
								@click="() => playChapter(chapter)"
								tabindex="0"
							>
								<div class="number">
									<i v-if="chapter === currentChapter" class="pi pi-volume-up" />
									<div v-else>{{ chapter.trackNumber || Number(index) + 1 }}</div>
								</div>
								<div class="title">{{ chapter.title }}</div>
								<div class="duration">{{ formatRuntime(chapter.titleStartOffset) }}</div>
							</div>
						</template>
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
	height: 100%;
	min-height: 0;
	max-height: 100%;
	overflow: hidden;

	.top-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.5em;
   		padding: 0 1em;
    	flex-grow: 1;
	}

	.other-wrapper {
		flex-grow: 2;
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
		align-items: stretch;
		padding-left: 1rem;
	}
}


.poster-wrapper {
	width: min(100%, 20rem, 40vh)
}

.chapters-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.chapter-item {
	font-size: 1.2rem;
	display: grid;
	grid-template-columns: 2em 1fr auto;
	align-items: center;
	gap: .5rem;
	padding: 0.8em 0.7em;
	cursor: pointer;

	
	&.active {
		background-color: #fff1;
		.title { font-weight: bold; }
	}

	.number {
		text-align: center;
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
