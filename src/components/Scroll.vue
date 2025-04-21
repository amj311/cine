<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, useSlots } from 'vue';

const scrollArea = ref<HTMLElement | null>(null);
defineExpose({
	scrollArea,
});

const isScrolling = ref(false);
const scrollTimeout = ref<number | null>(null);
const scrollDelay = 1000;

onMounted(() => {
	scrollArea.value?.addEventListener('scroll', () => {
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

const thumbHover = ref(false);

</script>

<template>
	<div class="scroll" :class="{ hide: !isScrolling && !thumbHover }" @mouseenter="thumbHover = true" @mouseleave="thumbHover = false">
		<div class="scroll-area" ref="scrollArea">
			<div class="content-wrapper" @mouseenter="thumbHover = false" @mouseleave="thumbHover = true">
				<slot></slot>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">

.scroll {
	display: contents;

	/* Make all scrollbars hidden initially, with transparent bg, with --color-background-muted bars */
	& > ::-webkit-scrollbar {
		width: 22px;
		height: 22px;
	}

	& > ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner {
		background-color: transparent;
	}


	& > ::-webkit-scrollbar-thumb {
		box-shadow: none !important;
	}

	&:not(.hide) > ::-webkit-scrollbar-thumb {
		border-radius: 10px;
		border: 9px solid transparent; /* Add transparent space around the thumb */
		// use box shadow as the background color
		box-shadow: inset 0 0 0 20px var(--color-contrast) !important;
		transition: 500ms;
	}

	.scroll-area {
		overflow: auto;
	}

	.content-wrapper {
		display: contents;
	}
}
</style>