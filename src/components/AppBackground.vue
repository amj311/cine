<script
	setup
	lang="ts"
>
import { useBackgroundStore } from '@/stores/background.store';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const canvasRef = ref<HTMLCanvasElement | null>(null);

const backgroundStore = useBackgroundStore();
const backgroundImage = computed(() => backgroundStore.backgroundUrl ? `url("${backgroundStore.backgroundUrl}")` : undefined);

function getCanvasCtx() {
	if (!canvasRef.value) {
		return null;
	}
	return canvasRef.value.getContext('2d');
}

watch(() => backgroundStore.posterUrl, async (newUrl) => {
	if (!canvasRef.value) {
		return;
	}
	// Clear existing canvas
	clearPoster();

	if (!newUrl) {
		return;
	}

	drawPoster(newUrl).catch((err) => {
		console.error('Error drawing poster:', err);
	});
});

function clearPoster() {
	const ctx = getCanvasCtx();
	if (!canvasRef.value || !ctx) {
		return;
	}
	if (ctx) {
		ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
		canvasRef.value.classList.remove('drawn');
	}
}

/**
 * Draws an image, as a gradient applied to it, above another image.
 * @param {Image} baseImg - Image that is applied under the gradient
 * @param {Image} gradImg - Image to be applied as a gradient
 */
async function drawPoster(url) {
	const ctx = getCanvasCtx();
	if (!canvasRef.value || !ctx) {
		return;
	}
	const gradImg = await loadImage(url);

	const STANDARD_WIDTH = 1280;
	const adjustedImageHeight = Math.floor((gradImg.height / gradImg.width) * STANDARD_WIDTH);
	const width = Math.floor(STANDARD_WIDTH);
	const height = Math.floor(adjustedImageHeight);

	canvasRef.value.width = width;
	canvasRef.value.height = height;
	
	ctx.drawImage(gradImg, 0, 0, width, height);

	const yOffset = 0 - height * .8; // to lift gradient into area
	const gradient = ctx.createRadialGradient(width, yOffset, width / 2, width, yOffset, width);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
	gradient.addColorStop(.75, 'rgba(255, 255, 255, .75)');
	gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');

	ctx.fillStyle = gradient;
	ctx.globalCompositeOperation = 'destination-out';
	ctx.fillRect(0, 0, width, height);
	canvasRef.value.classList.add('drawn');
};

/**
 * Loads an Image object via a Promise.
 * @param {String} url - Location of an image file
 * @return {Promise<Image>} Returns a promise that resolves to an Image.
 */
 function loadImage(url) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.addEventListener('load', () => resolve(img));
		img.addEventListener('error', reject);
		img.src = url;
	});
};

const route = useRoute();
const showCustomBackgrounds = computed(() => {
	return route?.name === 'browse';
});

</script>

<template>
	<div :style="{ backgroundImage: showCustomBackgrounds ? backgroundImage : undefined }" class="app-background"></div>
	<div class="app-background-overlay"></div>
	<canvas ref="canvasRef" id="app-background-canvas" :class="{ show: showCustomBackgrounds }"></canvas>
</template>

<style lang="scss">
	.app-background {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		background-image: url(@/assets/bg.jpg);
		filter: blur(50px);
		z-index: -1;
		transition: all 600ms;
	}
	.app-background-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--color-background);
		opacity: 0.7;
		z-index: -1;
	}

	#app-background-canvas {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 95%;
		z-index: -1;
		opacity: 0;
		transition: all 600ms;

		&.drawn.show {
			opacity: .7;
		}
	}
</style>
