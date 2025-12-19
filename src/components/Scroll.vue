<script lang="ts" setup>
import { useNavigationStore } from '@/stores/tvNavigation.store';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const scrollArea = ref<HTMLElement | null>(null);
defineExpose({
	scrollArea,
});

const isScrolling = ref(false);
const scrollTimeout = ref<number | null>(null);
const showScrollDelay = 1000;

onMounted(() => {
	scrollArea.value?.addEventListener('scroll', () => {
		if (scrollTimeout.value) {
			clearTimeout(scrollTimeout.value);
		}
		isScrolling.value = true;

		scrollTimeout.value = window.setTimeout(() => {
			isScrolling.value = false;
		}, showScrollDelay);
	});

	scrollArea.value?.addEventListener('mousemove', doHoverScroll);
	scrollArea.value?.addEventListener('mouseleave', () => {
		if (hoverScrollTimeout.value) {
			clearTimeout(hoverScrollTimeout.value);
			hoverScrollTimeout.value = null;
		}
	});
})

onBeforeUnmount(() => {
	if (scrollTimeout.value) {
		clearTimeout(scrollTimeout.value);
	}
});

const hoverScrollDelta = 20;
const maxDelta = 40;
const hoverScrollTime = 70;
const hoverScrollTimeout = ref<number | null>(null);
const scrollingEdge = ref<string | null>(null);
const screenMouseX = ref(0);
const screenMouseY = ref(0);

function doHoverScroll(event: MouseEvent) {
	if (!useNavigationStore().detectedTv) {
		return;
	}

	const startTime = Date.now();

	// First find out if the mouse is the sides of a scroll area
	const edgeMargin = 50;
	const scrollArea = event.currentTarget as HTMLElement;
	const rect = scrollArea.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const mouseY = event.clientY - rect.top;
	screenMouseX.value = event.clientX;
	screenMouseY.value = event.clientY;

	if (mouseX < edgeMargin) {
		// Mouse is on the left side
		scrollingEdge.value = 'left';
	} else if (mouseX > rect.width - edgeMargin) {
		// Mouse is on the right side
		scrollingEdge.value = 'right';
	} else if (mouseY < edgeMargin) {
		// Mouse is on the top side
		scrollingEdge.value = 'up';
	} else if (mouseY > rect.height - edgeMargin) {
		// Mouse is on the bottom side
		scrollingEdge.value = 'down';
	} else {
		// Mouse is not on the edge
		scrollingEdge.value = null;
	}

	function doEdgeScroll(edge) {
		const timeScrolling = Date.now() - startTime;
		const deltaMult = timeScrolling > 5000 ? 2 : 1;
		const useDelta = Math.min(hoverScrollDelta * deltaMult, maxDelta);
		let deltaX = 0;
		let deltaY = 0;
		if (edge === 'left' && scrollArea.scrollLeft > 0) {
			deltaX = -useDelta;
		} else if (edge === 'right' && scrollArea.scrollLeft < scrollArea.scrollWidth - scrollArea.clientWidth) {
			deltaX = +useDelta;
		} else if (edge === 'up' && scrollArea.scrollTop > 0) {
			deltaY = -useDelta;
		} else if (edge === 'down' && scrollArea.scrollTop < scrollArea.scrollHeight - scrollArea.clientHeight) {
			deltaY = +useDelta;
		}

		if (deltaX || deltaY) {
			scrollArea.scrollBy(deltaX, deltaY);
			hoverScrollTimeout.value = window.setTimeout(() => {
				doEdgeScroll(edge);
			}, hoverScrollTime);
			return;
		}
		else if (hoverScrollTimeout.value) {
			// Abort if we're already at the end of the scroll area
			scrollingEdge.value = null;
			clearTimeout(hoverScrollTimeout.value);
			hoverScrollTimeout.value = null;
		}
	}

	if (!scrollingEdge.value && hoverScrollTimeout.value) {
		clearTimeout(hoverScrollTimeout.value);
		hoverScrollTimeout.value = null;
		return;
	}
	if (scrollingEdge.value && !hoverScrollTimeout.value) {
		doEdgeScroll(scrollingEdge.value);
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

	<div class="edge-scroll-ui" v-if="hoverScrollTimeout" :style="{ top: screenMouseY + 'px', left: screenMouseX + 'px' }" :class="`scroll-${scrollingEdge}`">
		<i :class="`scroll-icon pi pi-angle-double-${scrollingEdge}`"></i>
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

.edge-scroll-ui {
	--size: 2em;
	line-height: var(--size);
	width: var(--size);
	height: var(--size);
	translate: -50% -50%;
	position: fixed;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
	pointer-events: none;
	font-size: 1.5rem;
	color: white;
	display: block;
	text-align: center;
	border-radius: 50%;
	background-color: rgba(0, 0, 0, 0.5);

	&.scroll-left {
		translate: 50% -50%;
	}
	&.scroll-right {
		translate: -150% -50%;
	}
	&.scroll-up {
		translate: -50% 50%;
	}
	&.scroll-down {
		translate: -50% -150%;
	}
}
</style>