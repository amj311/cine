<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore, type WatchProgress } from '@/stores/watchProgress.store';
import type DropdownMenuVue from '@/components/utils/DropdownMenu.vue';
import type SurpriseModal from '@/components/SurpriseModal.vue';
import type LibraryItemActions from '@/components/LibraryItemActions.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
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
const currentChapter = ref<any>(null);
const currentTrack = ref<{
	relativePath: string;
	duration: string;
} | null>(null);

onMounted(() => {
	if (audio.value) {
		audio.value.addEventListener('ended', playNextChapter);
		audio.value.addEventListener('play', startProgressUpdate);
		audio.value.addEventListener('pause', stopProgressUpdate);
	}
})

onBeforeUnmount(() => {
	stopProgressUpdate();
});

const isM4b = computed(() => props.libraryItem?.chapterStrategy === 'chapters');
const totalTime = computed(() => isM4b.value ? props.libraryItem?.chapters[0]?.trackDuration : props.libraryItem?.chapters.reduce((acc: number, chapter: any) => acc + chapter.duration, 0));

async function playChapter(chapter: any, time: number = chapter.trackStartOffset || 0) {
	if (currentChapter.value === chapter && !time) {
		return;
	}
	if (currentTrack.value?.relativePath !== chapter.relativePath) {
		currentTrack.value = {
			relativePath: chapter.relativePath,
			duration: chapter.trackDuration,
		};
	}
	currentChapter.value = chapter;
	if (audio.value) {
		audio.value.src = useApiStore().apiUrl + ('/stream?path=') + currentTrack.value!.relativePath;
		await audio.value.play();
		audio.value.currentTime = time;
		startProgressUpdate();

		// set device media image
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currentChapter.value.title,
				artist: currentChapter.value.artist,
				album: currentChapter.value.album,
				artwork: [
					{ src: useApiStore().resolve(props.libraryItem.cover), sizes: '512x512', type: 'image/png' },
					{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '256x256', type: 'image/png' },
					{ src: useApiStore().resolve(props.libraryItem.cover_thumb), sizes: '96x96', type: 'image/png' }
				],
			});

			navigator.mediaSession.setActionHandler('previoustrack', backChapter);
			navigator.mediaSession.setActionHandler('nexttrack', playNextChapter);
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

function backChapter() {
	if (!currentChapter.value || !audio.value) {
		return;
	}
	if (audio.value.currentTime > currentChapter.value.trackStartOffset + 5) {
		audio.value.currentTime = currentChapter.value.trackStartOffset || 0;
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

type Bookmark = WatchProgress & {
	name: string;
	chapterIndex: number;
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
		chapterIndex: findChapterIndexForBookmark(b.sub.relativePath, b.sub.time),
	})) || [];
});

function findChapterIndexForBookmark(relativePath, trackTime) {
	if (!isM4b.value) {
		return props.libraryItem.chapters.findIndex((chapter) => {
			return chapter.relativePath === relativePath;
		});
	}
	return props.libraryItem.chapters.findIndex((chapter, i) => {
		if (!props.libraryItem.chapters[i + 1]) {
			return true;
		}
		return trackTime >= chapter.bookStartOffset && trackTime < props.libraryItem.chapters[i + 1].bookStartOffset;
	})
}

function timeOffset(chapterIndex, timeIntoTrack: number) {
	const chapter = props.libraryItem.chapters[chapterIndex];
	if (!chapter) {
		return '';
	}
	return isM4b.value ? timeIntoTrack : timeIntoTrack + chapter.bookStartOffset;
}

function bookmarkTime(bookmarkName: string) {
	const bookmark = bookmarks.value.find((bookmark: any) => bookmark.name === bookmarkName);
	if (!bookmark) {
		return '';
	}
	return formatRuntime(timeOffset(bookmark.chapterIndex, bookmark.sub.time));
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
	playAtChapterTime(bookmark.chapterIndex, bookmark.sub.time);
}

function playAtChapterTime(chapterIndex: number, time: number) {
	if (!audio.value) {
		return;
	}
	const chapter = props.libraryItem.chapters[chapterIndex];
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
	if (!audio.value || !currentChapter.value) {
		return;
	}
	const currentChapterIndex = props.libraryItem.chapters.indexOf(currentChapter.value);
	return useWatchProgressStore().createProgress(
		timeOffset(currentChapterIndex, audio.value.currentTime),
		totalTime.value,
		{
			relativePath: currentChapter.value.relativePath,
			time: audio.value.currentTime,
			duration: currentChapter.value.duration,
		}
	);
}

async function postProgress(progress = getCurrentProgress()) {
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

		// check for new chapter
		if (isM4b.value) {
			const index = findChapterIndexForBookmark(
				props.libraryItem.relativePath,
				progress.sub!.time
			);
			if (index !== -1) {
				const chapter = props.libraryItem.chapters[index];
				if (currentChapter.value !== chapter) {
					playChapter(chapter, audio.value!.currentTime);
				}
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
			chapterIndex: findChapterIndexForBookmark(
				localProgress.sub.relativePath,
				localProgress.sub.time
			),
		};
	}
	if (!props.libraryItem?.watchProgress) {
		return null;
	}
	const lastWatchedIndex = findChapterIndexForBookmark(
		props.libraryItem.watchProgress.sub.relativePath,
		props.libraryItem.watchProgress.sub.time
	);
	return {
		...props.libraryItem.watchProgress,
		chapterIndex: lastWatchedIndex,
	};
})

const surpriseModal = ref<InstanceType<typeof SurpriseModal>>();

const menuItems = [{
	label: 'Surprise',
	icon: 'pi pi-gift',
	command: () => {
		surpriseModal.value?.open();
	},
}]

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
							style="width: 100%; aspect-ratio: 1; transform: rotateY(-31deg); transform-origin: right center; border-radius: 1%;"
						>
							<img
								class="absolute"
								:src="useApiStore().resolve(libraryItem?.cover)" style="inset: 0; width: 100%; aspect-ratio: 1;"
								@error="imageError = 'Failed to load cover'"
							/>
							<div class="book-texture absolute" style="inset: 0px; background-image: linear-gradient(to right, transparent 1%, rgba(0, 0, 0, 0.533) 4%, transparent 5%), linear-gradient(to right, transparent 4%, rgba(255, 255, 255, 0.1) 6%, transparent 9%); box-shadow: inset 3px 3px 2px 0px #fff3, inset -2px -2px 1px 0px #0005;" />
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
					<audio v-show="currentChapter" ref="audio" preload="auto" controls crossorigin="use-credentials" />
					<Button
						v-if="!currentChapter && lastWatched"
						icon="pi pi-play"
						:label="`Resume ${formatRuntime(timeOffset(lastWatched.chapterIndex, lastWatched.sub.time))}`"
						size="large"
						class="w-full"
						@click="() => playAtChapterTime(lastWatched.chapterIndex, lastWatched.sub.time)"
						data-focus-priority="1"
					/>
					<Button
						v-else-if="!currentChapter && !lastWatched"
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
				<LibraryItemActions ref="libraryItemActions" :libraryItem="libraryItem" />
			</div>
		</div>
		<div class="other-wrapper">
			<div class="chapters-list-wrapper" v-if="libraryItem?.chapters">
				<Scroll>
					<div class="chapters-list">
						<div
							class="chapter-item"
							:class="{ 'active': currentChapter ? chapter === currentChapter : index === lastWatched?.chapterIndex }"
							v-for="(chapter, index) in libraryItem.chapters"
							:key="index"
							@click="() => playChapter(chapter)"
							tabindex="0"
						>
							<div class="number">
								<i v-if="chapter === currentChapter" class="pi pi-volume-up" />
								<div v-else>{{ Number(index) + 1 }}</div>
							</div>
							<div class="title">{{ chapter.title }}</div>
							<div class="duration">{{ formatRuntime(chapter.bookStartOffset) }}</div>
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
	&:hover {
		background-color: #fff2;
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
