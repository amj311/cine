<script setup lang="ts">
import { useRouter } from 'vue-router';
import MediaCard from './MediaCard.vue';
import { useQueryPathStore } from '@/stores/queryPath.store';
const router = useRouter();

const props = defineProps<{
	libraryItem: any,	
	action?: () => void;
}>();
</script>

<template>
	<MetadataLoader :media="libraryItem">
		<template #default="{ metadata, isLoadingMetadata }">
			<MediaCard
				v-if="libraryItem.cinemaType === 'movie'"
				:imageUrl="metadata?.poster_thumb"
				:aspectRatio="'tall'"
				:title="libraryItem.name"
				:subtitle="libraryItem.year"
				:action="() => useQueryPathStore().goTo(libraryItem.relativePath)"
				:progress="libraryItem.watchProgress"
				:loading="isLoadingMetadata"
				:surprise="libraryItem.surprise"
			>
				<template #fallbackIcon>🎞️</template>
			</MediaCard>

			<MediaCard
				v-if="libraryItem.cinemaType === 'series'"
				tvNavable
				:imageUrl="metadata?.poster_thumb"
				:aspectRatio="'tall'"
				:title="libraryItem.name"
				:subtitle="`${libraryItem.numSeasons} Season${libraryItem.numSeasons.length ? 's' : ''}`"
				:progress="libraryItem.movie?.watchProgress"
				:action="() => useQueryPathStore().goTo(libraryItem.relativePath)"
				:loading="isLoadingMetadata"
				:surprise="libraryItem.surprise"
			>
				<template #fallbackIcon>📺</template>
			</MediaCard>

			<MediaCard
				v-if="libraryItem.type === 'album' || libraryItem.type === 'audiobook'"
				tvNavable
				:imageUrl="libraryItem.cover_thumb"
				:aspectRatio="'square'"
				:title="libraryItem.title"
				:subtitle="libraryItem.artist || libraryItem.author"
				:progress="libraryItem.watchProgress"
				:action="() => useQueryPathStore().goTo(libraryItem.relativePath)"
				:loading="isLoadingMetadata"
				:surprise="libraryItem.surprise"
			>
				<template #fallbackIcon>💿</template>
			</MediaCard>

			<MediaCard
				v-if="libraryItem.type === 'collection'"
				tvNavable
				:aspectRatio="'tall'"
				:title="libraryItem.name"
				:subtitle="`${libraryItem.children.length} items`"
				:action="() => useQueryPathStore().goTo(libraryItem.relativePath)"
			>
				<template #poster v-if="libraryItem.children.length">
					<CollectionPoster :paths="libraryItem.children" />
				</template>
				<template #fallbackIcon v-else>🗂️</template>
			</MediaCard>
		</template>
	</MetadataLoader>
</template>

<style scoped lang="scss">
.media-card {
	transition: transform 50ms ease-in-out;
	user-select: none;
	border-radius: 5px;
	overflow: hidden;

	&.clickable:hover, &[tv-focus] {
		cursor: pointer;
		background-color: var(--color-background-mute);
		border: 3px solid var(--color-background-mute);
		margin: -3px;
		outline: 1px solid var(--color-contrast);
		transform: scale(1.03);
	}

	&:not(.clickable) {
		cursor: default;
		pointer-events: none;
	}

	.overlay {
		display: none;
	}

	&:hover, &[tv-focus] {
		.overlay {
			display: flex;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.3);

			.play-button {
				margin: auto auto;
				color: white;
				zoom: 2;
			}
		}

		.fallback-icon {
			background-color: var(--color-background-mute);	
		}
	}
}

.poster-image {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
}

.poster {
	position: relative;
	background-position: center;
	background-size: cover;
	background-repeat: no-repeat;
	border-radius: 5px;
	overflow: hidden;

	&.tall {
		aspect-ratio: 2/3;
	}
	&.wide {
		aspect-ratio: 3/2;
	}
	&.square {
		aspect-ratio: 1/1;
	}

	.custom-poster {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.fallback-icon {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		font-size: 3rem;
	}

	.progress-bar-wrapper {
		position: absolute;
		bottom: 0;
		width: 100%;
	}
}

.title, .subtitle {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: .85rem;
}
</style>
