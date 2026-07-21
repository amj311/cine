<script setup lang="ts">
import GalleryFileFrame, { type GalleryFile } from '@/components/GalleryFileFrame.vue';

const { file } = defineProps<{
	file: GalleryFile,
}>();
</script>

<template>
	<div
		class="photo-cell lazy-load"
		tabindex="0"
		:key="file.relativePath"
		:id="file.relativePath"
		data-tvNavJumpRow="photo_menu"
	>
		<GalleryFileFrame :file="file" :objectFit="'cover'" :hide-controls="true" :size="'small'" :thumbnail="true" />
		<div class="overlay">
			<i v-if="file.relativePath.endsWith('mp4')" class="play-icon pi pi-play" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.photo-cell {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: var(--color-background-mute);
	border-radius: 5px;
	cursor: pointer;

	&:hover, &[tv-focus] {
		scale: 1.03;
		outline: 1px solid var(--color-contrast);
	}

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
}


.play-icon {
	font-size: 1.5rem;
	color: var(--color-text);
	background-color: rgba(0, 0, 0, 0.5);
	width: 2.2em;
	line-height: 2.2em;
	text-align: center;
	aspect-ratio: 1;
	border-radius: 50%;
}

</style>
