<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, useSlots } from 'vue';

const scrollArea = ref<HTMLElement | null>(null);

const isScrolling = ref(false);
const scrollTimeout = ref<number | null>(null);
const scrollDelay = 1000;

onMounted(() => {
	scrollArea.value?.children?.[0]?.addEventListener('scroll', () => {
		if (isScrolling.value) {
			return;
		}
		if (scrollTimeout.value) {
			clearTimeout(scrollTimeout.value);
		}
		isScrolling.value = true;

		scrollTimeout.value = window.setTimeout(() => {
			isScrolling.value = false;
		}, scrollDelay);
	});
})

onBeforeUnmount(() => {
	if (scrollTimeout.value) {
		clearTimeout(scrollTimeout.value);
	}
});

</script>

<template>
	<div class="hide-scrollbar" :class="{ scrolling: isScrolling }" ref="scrollArea">
		<slot></slot>
	</div>
</template>

<style lang="scss">

.hide-scrollbar {
	/* Make all scrollbars hidden initially, with transparent bg, with --color-background-muted bars */
	::-webkit-scrollbar {
		width: 22px;
		height: 22px;
	}

	::-webkit-scrollbar-track {
		background-color: transparent;
	}

	::-webkit-scrollbar-thumb {
		border-radius: 10px;
		background-color: transparent;
		border: 9px solid transparent; /* Add transparent space around the thumb */
	}

	&.scrolling > ::-webkit-scrollbar-thumb {
		// use box shadow as the background color
		box-shadow: inset 0 0 0 20px var(--color-contrast) !important;
		transition: 500ms;

		&:hover {
			cursor: pointer;
		}
	}

}
</style>