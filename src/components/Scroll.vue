<script lang="ts" setup>
import { useTvNavigationStore } from '@/stores/tvNavigation.store';
import { onBeforeUnmount, onMounted, ref } from 'vue';

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

	scrollArea.value?.addEventListener('mousemove', doHoverScroll);
	scrollArea.value?.addEventListener('mouseleave', () => {
		if (hoverScrollInterval.value) {
			clearInterval(hoverScrollInterval.value);
			hoverScrollInterval.value = null;
		}
	});
})

onBeforeUnmount(() => {
	if (scrollTimeout.value) {
		clearTimeout(scrollTimeout.value);
	}
});

const hoverScrollTime = 25;
const hoverScrollInterval = ref<number | null>(null);
const scrollingEdge = ref<string | null>(null);

function doHoverScroll(event: MouseEvent) {
	if (!useTvNavigationStore().detectedTv) {
		return;
	}
	// First find out if the mouse is the sides of a scroll area
	const edgeMargin = 40;
	const scrollArea = event.currentTarget as HTMLElement;
	const rect = scrollArea.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const mouseY = event.clientY - rect.top;

	
	if (mouseX < edgeMargin) {
		// Mouse is on the left side
		scrollingEdge.value = 'left';
	} else if (mouseX > rect.width - edgeMargin) {
		// Mouse is on the right side
		scrollingEdge.value = 'right';
	} else if (mouseY < edgeMargin) {
		// Mouse is on the top side
		scrollingEdge.value = 'top';
	} else if (mouseY > rect.height - edgeMargin) {
		// Mouse is on the bottom side
		scrollingEdge.value = 'bottom';
	} else {
		// Mouse is not on the edge
		scrollingEdge.value = null;
	}

	function doEdgeScroll(edge) {
		let distanceLeft = 0;
		let distanceTop = 0;
		if (edge === 'left') {
			distanceLeft = -10;
		} else if (edge === 'right') {
			distanceLeft = +10;
		} else if (edge === 'top') {
			distanceTop = -10;
		} else if (edge === 'bottom') {
			distanceTop = +10;
		}
		scrollArea.scrollTo({
			left: scrollArea.scrollLeft + distanceLeft,
			top: scrollArea.scrollTop + distanceTop,
		});
	}

	if (!scrollingEdge.value && hoverScrollInterval.value) {
		clearInterval(hoverScrollInterval.value);
		hoverScrollInterval.value = null;
		return;
	}
	if (scrollingEdge.value && !hoverScrollInterval.value) {
		doEdgeScroll(scrollingEdge.value);
		hoverScrollInterval.value = window.setInterval(() => doEdgeScroll(scrollingEdge.value), hoverScrollTime);
	} 
	// Then start scroling there in intervals, or stop scrolling
}

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
		width: 8px;
		height: 8px;
	}

	& > ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner {
		background-color: transparent;
	}


	& > ::-webkit-scrollbar-thumb {
		box-shadow: none !important;
	}

	&:not(.hide) > ::-webkit-scrollbar-thumb {
		border-radius: 10px;
		border: 2px solid transparent; /* Add transparent space around the thumb */
		// use box shadow as the background color
		box-shadow: inset 0 0 0 20px var(--color-contrast) !important;
		transition: 500ms;
	}

	.scroll-area {
		overflow: auto;
		height: 100%;
		max-height: 100%;
		max-width: 100%;
	}

	.content-wrapper {
		display: contents;
	}
}
</style>