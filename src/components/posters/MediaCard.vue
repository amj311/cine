<script setup lang="ts">
import ProgressBar from '@/components/ProgressBar.vue'

defineProps<{
	imageUrl?: string;
	fallbackIcon?: string;
	aspectRatio?: 'tall' | 'wide';
	width?: number;
	height?: number;
	title?: string;
	subtitle?: string;
	progress?: number;
}>();

</script>

<template>
	<div>
		<div
			class="poster bg-soft"
			:class="aspectRatio || 'tall'"
			:style="{ backgroundImage: `url(${imageUrl})` }"
		>
			<div v-if="!imageUrl && fallbackIcon" class="fallback-icon">
				{{ fallbackIcon }}
			</div>

			<div v-if="progress" class="progress-bar-wrapper">
				<ProgressBar :progress="progress" />
			</div>

			<div v-if="$slots.overlay" class="overlay">
				<slot name="overlay"></slot>
			</div>
		</div>
		<div v-if="title || subtitle">
			<div v-if="title" class="title">{{ title }}</div>
			<div v-if="subtitle" class="subtitle" style="opacity: .7">{{ subtitle }}</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
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

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

}
</style>
