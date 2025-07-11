<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import MediaCard from '@/components/MediaCard.vue';
import { useApiStore } from '@/stores/api.store';
import GalleryFileFrame from '@/components/GalleryFileFrame.vue';
import Slideshow from '@/components/Slideshow.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';

const feed = ref<any[]>([]);

async function loadFeed() {
	try {
		const { data } = await useApiStore().api.get('/feed');
		feed.value = data.data;
	}
	catch (error) {
		console.error('Error loading feed:', error);
	}
}

onBeforeMount(() => {
	loadFeed();
});

function playableName(playable: any, parentLibraryItem: any) {
	if (playable.type === 'episodeFile') {
		return parentLibraryItem.name + ' ' + playable.name;
	}
	return playable.name;
}

/**
 * "xhr ymin" format
 * @param watchProgress 
 */
function timeRemaining(watchProgress: any) {
	const time = watchProgress.time;
	const duration = watchProgress.duration;
	const remainingTime = duration - time;
	const hours = Math.floor(remainingTime / 3600);
	const minutes = Math.floor((remainingTime % 3600) / 60);

	return `${hours ? (hours + 'hr ') : '' }${minutes}min`;
}


const slideshow = ref<InstanceType<typeof Slideshow> | null>(null);
function openSlideshow(files: any[], firstFile?: any) {
	if (slideshow.value) {
		slideshow.value.open(files, firstFile);
	}
}

</script>

<template>
	<div class="home-view h-full">
		<div class="feed h-full">
			<Scroll>
				<div class="feed-row" v-for="feedRow in feed" :class="feedRow.type" :key="feedRow.type">
					<template v-if="feedRow.type === 'continue-watching'">
						<h3>{{ feedRow.title }}</h3>
						<div class="feed-scroll-wrapper">
							<Scroll class="feed-scroll">
								<div class="feed-row-items-list">
									<div
										class="feed-row-card-wrapper"
										:class="item.libraryItem.playable?.type"
										v-for="item in feedRow.items"
										:key="item.relativePath"
									>
										<MediaCard
											v-if="item.libraryItem.playable?.type === 'album' || item.libraryItem.playable?.type === 'audiobook'"
											clickable
											:action="() => $router.push({ name: 'browse', query: { path: item.libraryItem.playable.relativePath } })"
											:imageUrl="item.libraryItem.playable.cover_thumb"
											:imagePosition="'top'"
											:progress="item.watchProgress"
											:aspectRatio="'square'"
											:title="item.libraryItem.playable.title"
											:subtitle="`${timeRemaining(item.watchProgress)} left`"
										>
											<template #fallbackIcon>💿</template>
										</MediaCard>
										<MediaCard
											v-else
											:imageUrl="item.libraryItem.playable?.still_thumb || item.libraryItem.parentLibrary?.metadata?.background_thumb || item.libraryItem.parentLibrary?.metadata?.poster_thumb"
											:imagePosition="'top'"
											:playSrc="item.relativePath"
											:progress="item.watchProgress"
											:aspectRatio="'wide'"
											:title="playableName(item.libraryItem.playable, item.libraryItem.parentLibrary)"
											:subtitle="item.isUpNext ? 'Up Next' : `${timeRemaining(item.watchProgress)} left`"
										>
											<template #fallbackIcon>🎞️</template>
										</MediaCard>
									</div>
								</div>
							</Scroll>
						</div>
					</template>

					<template v-if="feedRow.type === 'cinema-items'">
						<h3>{{ feedRow.title }}</h3>
						<div class="feed-scroll-wrapper">
							<Scroll class="feed-scroll">
								<div class="feed-row-items-list">
									<div
										class="feed-row-card-wrapper"
										:class="item.type"
										v-for="item in feedRow.items"
										:key="item.relativePath"
									>
										<MetadataLoader :media="item.libraryItem"><template #default="{ metadata }">
											<!-- <MediaCard
												v-if="item.libraryItem.playable?.type === 'album' || item.libraryItem.playable?.type === 'audiobook'"
												clickable
												:action="() => $router.push({ name: 'browse', query: { path: item.libraryItem.playable.relativePath } })"
												:imageUrl="item.libraryItem.playable.cover_thumb"
												:imagePosition="'top'"
												:progress="item.watchProgress"
												:aspectRatio="'square'"
												:title="item.libraryItem.playable.title"
												:subtitle="`${timeRemaining(item.watchProgress)} left`"
											>
												<template #fallbackIcon>💿</template>
											</MediaCard> -->
											<MediaCard
												:imageUrl="metadata?.poster_thumb"
												:aspectRatio="'tall'"
												:title="item.title"
												:action="() => $router.push({ name: 'browse', query: { path: item.relativePath } })"
												:progress="item.watchProgress"
											>
												<template #fallbackIcon>🎞️</template>
											</MediaCard>
										</template></MetadataLoader>
									</div>
								</div>
							</Scroll>
						</div>
					</template>

					<template v-else-if="feedRow.type === 'photos'">
						<h3>{{ feedRow.title }}</h3>
						<div class="photo-grid mt-3">
							<div
								class="photo-grid-cell"
								v-for="item in feedRow.items"
								:key="item.relativePath"
								tabindex="0"
								@click="openSlideshow(feedRow.items, item)"
							>
								<GalleryFileFrame
									:file="item"
									:objectFit="'cover'"
									:hide-controls="true"
									:size="'small'"
									:thumbnail="true"
								/>
							</div>
						</div>
					</template>
				</div>
			</Scroll>
		</div>
	</div>

	<Slideshow ref="slideshow" />
</template>

<style scoped lang="scss">
.feed-row {
	--padding: 15px;
	padding: var(--padding);

	.feed-scroll-wrapper {
		margin: 0 calc(-1 * var(--padding));
	}

	.feed-row-items-list {
		padding: 10px var(--padding);
		display: flex;
		gap: 15px;
	}

	&.continue-watching .feed-row-card-wrapper {
		--baseWidth: min(15rem, max(8rem, 30vw));
		width: var(--baseWidth);
		min-width: var(--baseWidth);
		max-width: var(--baseWidth);

		&.album, &.audiobook {
			--mult: 0.66;
			width: calc(var(--baseWidth) * var(--mult));
			min-width: calc(var(--baseWidth) * var(--mult));
			max-width: calc(var(--baseWidth) * var(--mult));
		}
	}


	&.cinema-items .feed-row-card-wrapper {
		--baseWidth: min(8rem, 30vw);
		width: var(--baseWidth);
		min-width: var(--baseWidth);
		max-width: var(--baseWidth);
	}

	&.photos .photo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 10px;

		.photo-grid-cell {
			cursor: pointer;
			aspect-ratio: 1;
			overflow: hidden;
			border-radius: 10px;
			background-color: var(--color-background);
			box-shadow: var(--shadow-1);
			transition: all 0.2s ease-in-out;

			&:hover {
				box-shadow: var(--shadow-2);
				transform: scale(1.05);
			}
		}
	}
}

</style>
