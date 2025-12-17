<script
	setup
	lang="ts"
>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBackgroundStore } from '@/stores/background.store';
import { useApiStore } from '@/stores/api.store';
import { useWatchProgressStore, type WatchProgress } from '@/stores/watchProgress.store';
import type DropdownMenuVue from '@/components/utils/DropdownMenu.vue';
import type SurpriseModal from '@/components/SurpriseModal.vue';

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
		audio.value.src = useApiStore().apiUrl + ('/stream?src=') + currentTrack.value!.relativePath;
		await audio.value.play();
		audio.value.currentTime = time;
		startProgressUpdate();

		// set device media image
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currentChapter.value.title,
				artist: currentChapter.value.author,
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

</script>

<template>
	<div class="album-page">
		<div class="top-wrapper my-3">
			<div class="poster-wrapper">
				<MediaCard
					:imageUrl="libraryItem?.cover"
					:aspectRatio="'square'"
					:progress="lastWatched || libraryItem?.watchProgress"
				/>
			</div>
			<div class="flex flex-column align-items-center gap-2">
				<div class="flex align-items-center gap-2">
					<h3>{{ libraryItem.title }}</h3>
					<DropdownMenu :model="menuItems"><Button size="small" variant="text" severity="contrast" :icon="'pi pi-ellipsis-v'" /></DropdownMenu>
				</div>
				<div class="flex align-items-center justify-content-center">
					<span v-if="libraryItem.author">{{ libraryItem.author }}&nbsp;-&nbsp;</span>
					<span v-if="libraryItem.year">{{ libraryItem.year }}&nbsp;-&nbsp;</span>
					<span>{{ formatRuntime(totalTime) }}</span>
				</div>
			</div>
		</div>
		<div class="other-wrapper">
			<div class="controls px-2 flex align-items-center">
				<div class="audio-controls flex-grow-1">
					<audio v-show="currentChapter" ref="audio" preload="auto" controls />
					<Button
						v-if="!currentChapter && lastWatched"
						icon="pi pi-play"
						:label="`Resume ${formatRuntime(timeOffset(lastWatched.chapterIndex, lastWatched.sub.time))}`"
						size="large"
						class="w-full"
						@click="() => playAtChapterTime(lastWatched.chapterIndex, lastWatched.sub.time)"
					/>
					<Button
						v-else-if="!currentChapter && !lastWatched"
						icon="pi pi-play"
						:label="`Play All`"
						size="large"
						class="w-full"
						@click="() => playChapter(libraryItem?.chapters[0])"
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
			</div>
			<div class="chapters-list-wrapper" v-if="libraryItem?.chapters">
				<Scroll>
					<div class="chapters-list">
						<div
							class="chapter-item"
							:class="{ 'active': currentChapter ? chapter === currentChapter : index === lastWatched?.chapterIndex }"
							v-for="(chapter, index) in libraryItem.chapters"
							:key="index"
							@click="() => playChapter(chapter)"
						>
							<div><i :class="`pi pi-${chapter === currentChapter ? 'volume-up' : 'play'}`" /></div>
							<div class="number">{{ index + 1 }}</div>
							<div class="title">{{ chapter.title }}</div>
							<div class="duration">{{ formatRuntime(chapter.bookStartOffset) }}</div>
						</div>
					</div>
					<br />
				</Scroll>
			</div>
		</div>
	</div>

	<SurpriseModal ref="surpriseModal" :libraryItem="libraryItem" />
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

.chapters-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.chapter-item {
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
