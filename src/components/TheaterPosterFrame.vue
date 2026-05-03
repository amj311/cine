<script setup lang="ts">
import { toRef } from 'vue';
import { useApiStore } from '@/stores/api.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import MetadataLoader from './MetadataLoader.vue';

const props = defineProps<{
	libraryItem: any;
}>();

const libraryItem = toRef(props, 'libraryItem');
function posterUrl(item: any, metadata: any): string | undefined {
	return item.poster || item.cover_thumb || metadata?.poster_thumb || undefined;
}

function title(item: any): string {
	return item.name || item.title || '';
}

function subtitle(item: any): string {
	if (item.year) return item.year;
	if (item.artist) return item.artist;
	if (item.author) return item.author;
	if (item.numSeasons) return `${item.numSeasons} Season${item.numSeasons !== 1 ? 's' : ''}`;
	return '';
}
</script>

<template>
	<MetadataLoader v-model:media="libraryItem">
		<template #default="{ metadata }">
			<div
				class="theater-frame"
				role="button"
				tabindex="0"
				:aria-label="title(libraryItem)"
				@click="useQueryPathStore().goTo(libraryItem.relativePath)"
				@keydown.enter.prevent="useQueryPathStore().goTo(libraryItem.relativePath)"
				@keydown.space.prevent="useQueryPathStore().goTo(libraryItem.relativePath)"
			>
				<div class="frame-border">
					<!-- Corner bolts -->
					<div class="bolt tl" />
					<div class="bolt tr" />
					<div class="bolt bl" />
					<div class="bolt br" />

					<div class="frame-inner">
						<img
							v-if="posterUrl(libraryItem, metadata)"
							:src="useApiStore().resolve(posterUrl(libraryItem, metadata)!)"
							class="poster-img"
							:alt="title(libraryItem)"
						/>
						<div v-else class="poster-fallback">
							<span class="fallback-icon">🎞️</span>
						</div>
						<div class="backlight" />
					</div>
				</div>

				<div class="title-strip">
					<div class="title-text">{{ title(libraryItem) }}</div>
					<div v-if="subtitle(libraryItem)" class="subtitle-text">{{ subtitle(libraryItem) }}</div>
				</div>
			</div>
		</template>
	</MetadataLoader>
</template>

<style scoped lang="scss">
.theater-frame {
	position: relative;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	align-items: center;
	user-select: none;
	width: 100%;

	// Corner bolts
	.bolt {
		position: absolute;
		width: 4%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #ccc, #555);
		box-shadow: 0 1px 2px #000a;
		z-index: 10;

		&.tl { top: 2%; left: 2%; }
		&.tr { top: 2%; right: 2%; }
		&.bl { bottom: 2%; left: 2%; }
		&.br { bottom: 2%; right: 2%; }
	}

	.frame-border {
		position: relative;
		width: 100%;
		aspect-ratio: 2 / 3;
		background: linear-gradient(145deg, #3a3a3a, #1a1a1a, #3a3a3a);
		border-radius: 4px;
		padding: 10px;
		box-shadow:
			0 0 0 1px #555,
			0 0 18px 4px #000a,
			inset 0 1px 0 #666,
			inset 0 -1px 0 #222;
		transition: box-shadow 0.3s ease;
	}

	.frame-inner {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: 2px;
		box-shadow: inset 0 0 8px #0008;
	}

	.poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center top;
		display: block;
	}

	.poster-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #111;

		.fallback-icon {
			font-size: 3rem;
		}
	}

	// Backlit edge glow
	.backlight {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 30px 6px #fff1;
		border-radius: 2px;
	}

	// Title strip below frame
	.title-strip {
		width: 100%;
		margin-top: 6px;
		background: linear-gradient(180deg, #1c1c1c, #111);
		border: 1px solid #333;
		border-radius: 3px;
		padding: 6px 10px;
		text-align: center;
		box-shadow: 0 2px 6px #0008;

		.title-text {
			font-size: 0.8rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: #f0e6c8;
			line-height: 1.2;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.subtitle-text {
			font-size: 0.65rem;
			letter-spacing: 0.06em;
			color: #a89060;
			margin-top: 2px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	// Hover: brighten glow
	&:hover, &:focus-visible, &[tv-focus] {
		outline: none;

		.frame-border {
			box-shadow:
				0 0 0 1px #888,
				0 0 30px 8px #0008,
				0 0 50px 10px #c8a44022,
				inset 0 1px 0 #888,
				inset 0 -1px 0 #333;
		}

		.backlight {
			box-shadow: inset 0 0 40px 10px #fff2;
		}
	}
}
</style>
