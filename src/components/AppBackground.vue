<script
	setup
	lang="ts"
>
import { useBackgroundStore } from '@/stores/background.store';
import { computed } from 'vue';
const backgroundStore = useBackgroundStore();

const backgroundImage = computed(() => `url(${backgroundStore.backgroundUrl})`);

</script>

<template>
	<div :style="{ backgroundImage }" class="app-background"></div>
	<div class="app-background-overlay"></div>
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
		filter: blur(20px);
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
</style>
