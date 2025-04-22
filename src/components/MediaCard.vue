<script setup lang="ts">
import ProgressBar from '@/components/ProgressBar.vue'
import { useRouter } from 'vue-router';
const router = useRouter();

const props = defineProps<{
	imageUrl?: string;
	fallbackIcon?: string;
	aspectRatio?: 'tall' | 'wide';
	width?: number;
	height?: number;
	title?: string;
	subtitle?: string;
	progress?: any; // Progress
	overrideStartTime?: number;
	playSrc?: string;
	clickable?: boolean;
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


</script>

<template>
	<div class="media-card" :class="{ clickable: clickable || playSrc }" @click="playVideo">
		<div
			class="poster bg-soft"
			:class="aspectRatio || 'tall'"
			:style="{ backgroundImage: `url(${imageUrl})` }"
		>
			<div v-if="!imageUrl && fallbackIcon" class="fallback-icon">
				{{ fallbackIcon }}
			</div>

			<div v-if="progress" class="progress-bar-wrapper">
				<ProgressBar :progress="progress.percentage" />
			</div>

			<div v-if="playSrc" class="overlay">
				<div class="play-button">▶︎</div>
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

	&.clickable:hover {
		cursor: pointer;
		background-color: var(--color-background-mute);
		outline: 3px solid var(--color-background-mute);
		transform: scale(1.05);
	}

	.overlay {
		display: none;
	}

	&:hover {
		.overlay {
			display: flex;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.2);

			.play-button {
				margin: auto auto;
				font-size: 2rem;
				color: white;
			}
		}

		.poster {
			background-color: var(--color-background-mute);	
		}
	}
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
}
</style>
