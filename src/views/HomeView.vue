<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import api from '@/services/api';
import MediaCard from '@/components/MediaCard.vue';

const feed = ref<any[]>([]);

async function loadFeed() {
	try {
		const { data } = await api.get('/feed');
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

</script>

<template>
	<div class="home-view">
		<div class="feed">
			<Scroll>
				<div class="feed-row" v-for="feedRow in feed" :class="feedRow.type" :key="feedRow.type">
					<h3>{{ feedRow.title }}</h3>
					<div class="feed-scroll-wrapper">
						<Scroll class="feed-scroll">
							<div class="feed-row-items-list">
								<div
									class="feed-row-card-wrapper"
									v-for="item in feedRow.items"
								>
									<MediaCard
										:key="item.relativePath"
										:imageUrl="item.libraryItem.parentLibrary.metadata.poster_thumb"
										:imagePosition="'top'"
										:playSrc="item.relativePath"
										:progress="item.watchProgress"
										:aspectRatio="'wide'"
										:title="playableName(item.libraryItem.playable, item.libraryItem.parentLibrary)"
										:subtitle="item.isUpNext ? 'Up Next' : `${timeRemaining(item.watchProgress)} left`"
									>
										<template #fallbackIcon>🎬</template>
									</MediaCard>
								</div>
							</div>
						</Scroll>
					</div>
				</div>
			</Scroll>
		</div>
	</div>
</template>

<style scoped lang="scss">
.feed-row {
	--padding: 15px;
	padding: var(--padding);

	h2 {
		// margin-bottom: 10px;
	}

	.feed-scroll-wrapper {
		margin: 0 calc(-1 * var(--padding));
	}

	.feed-row-items-list {
		padding: 10px var(--padding);
		display: flex;
		gap: 15px;
	}

	&.continue-watching .feed-row-card-wrapper {
		width: min(225px, 30vw);
		min-width: min(225px, 30vw);
	}
}

</style>
