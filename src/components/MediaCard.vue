<script setup lang="ts">
import ProgressBar from '@/components/ProgressBar.vue'
import { useApiStore } from '@/stores/api.store';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();

const props = defineProps<{
	imageUrl?: string;
	imagePosition?: 'top' | 'center' | 'bottom';
	aspectRatio?: 'tall' | 'wide' | 'square';
	width?: number;
	height?: number;
	title?: string;
	subtitle?: string;
	progress?: any; // Progress
	overrideStartTime?: number;
	playSrc?: string;
	clickable?: boolean;
	action?: () => void;
}>();


function playVideo() {
	if (!props.playSrc) {
		return;
	}
	router.push({
		name: 'play',
		query: {
			path: props.playSrc,
			startTime: ((props.progress?.percentage < 90 && props.progress?.time) || props.overrideStartTime) ?? undefined,
		}
	})
}

const onClick = computed(() => {
	if (props.action) {
		return props.action;
	}
	if (props.playSrc) {
		return playVideo;
	}
	return undefined;
});

const imageError = ref<any>(null);
</script>

<template>
	<div class="media-card" :class="{ clickable: onClick }" @click="onClick" :tabindex="onClick ? 0 : -1">
		<div
			class="poster"
			:class="aspectRatio || 'tall'"
		>	
			<div v-if="$slots.fallbackIcon" class="fallback-icon bg-soft">
				<slot name="fallbackIcon" />
			</div>

			<img v-if="imageUrl && !imageError" :src="useApiStore().resolve(imageUrl)" class="poster-image" :style="{ objectPosition: imagePosition || 'center' }" @error="(err) => imageError = err" />

			<div v-if="$slots.poster" class="custom-poster">
				<slot name="poster" />
			</div>

			<div v-if="progress?.percentage" class="progress-bar-wrapper">
				<ProgressBar :progress="progress.percentage" />
			</div>

			<div v-if="playSrc" class="overlay">
				<div class="play-button"><i class="pi pi-play" /></div>
			</div>
		</div>
		<div v-if="title || subtitle" class="mt-1 p-1">
			<div v-if="title" class="title">{{ title }}</div>
			<div v-if="subtitle" class="subtitle" style="opacity: .7">{{ subtitle }}</div>

		</div>
	</div>
</template>

<style scoped lang="scss">
.media-card {
	transition: transform 50ms ease-in-out;
	user-select: none;
	border-radius: 5px;
	overflow: hidden;

	&.clickable:hover, &:focus {
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

	&:hover, &:focus {
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
