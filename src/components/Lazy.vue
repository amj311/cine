<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const wrapper = ref<HTMLDivElement>();
const children = computed(() => {
	if (!wrapper.value) {
		return [];
	}
	// Children must have an id to be considered
	const lazyElsClass = "lazy-load"
	const lazyEls = Array.from(wrapper.value.querySelectorAll(`.${lazyElsClass}`));
	return lazyEls.filter((child) => Boolean((child as HTMLElement).id));
});

const updateDelay = 500;
const updateTimeout = ref<number | null>(null);
function debounceUpdate() {
	if (updateTimeout.value) {
		clearTimeout(updateTimeout.value);
	}
	updateTimeout.value = window.setTimeout(() => {
		updateScrollRange();
	}, updateDelay);
}

const inRangeIds = ref<Record<string, boolean>>({});
let previousFinalSearchIndex = 0;
let upperRange = 0;
let lowerRange = 0;

function updateScrollRange() {
	setRange();
	const startingIndex = Math.min(previousFinalSearchIndex, children.value.length - 1);

	// Scan updates in both directions from the starting index
	const { updates: upUpdates, finalIndex: upFinalIndex } = updateInDirection('up', startingIndex);
	const { updates: downUpdates, finalIndex: downFinalIndex } = updateInDirection('down', startingIndex);

	if (upFinalIndex !== -1) {
		previousFinalSearchIndex = upFinalIndex;
	}
	else if (downFinalIndex !== -1) {
		previousFinalSearchIndex = downFinalIndex;
	}
	else {
		previousFinalSearchIndex = 0;
	}

	// Update ref!
	inRangeIds.value = {
		...inRangeIds.value,
		...upUpdates,
		...downUpdates,
	};
}

/**
 * Updates whether each in element is range or not from the starting index in the given direction
 * Stops when a) the next element is not in range and b) the next element was not previously marked as in range
 * Returns the last index that was marked as in range in this direction, or -1 if none were.
 * @param direction 
 * @param startingIndex 
 */
function updateInDirection(
	direction: 'up' | 'down',
	startingIndex: number,
): { updates: Record<string, boolean>, finalIndex: number } {
	// start at the starting index
	let currentIndex = startingIndex;
	const updates: Record<string, boolean> = {};

	function updateIndex() {
		if (direction === 'up') {
			currentIndex--;
		}
		else {
			currentIndex++;
		}
	}

	function isIndexOutOfBounds(index: number): boolean {
		if (index < 0 || index >= children.value.length) {
			return true;
		}
		return false;
	}

	function evaluateIndex(index: number) {
		const element = children.value[index] as HTMLElement;
		const distance = distanceFromRange(element);
		const isInRange = distance === 0;
		const wasInRange = inRangeIds.value[element.id] || false;
		let isRangeInDirection = true;
		// if the element is above range and the direction is up, then range is not in this direction
		if (direction === 'up' && distance < 0) {
			isRangeInDirection = false;
		}
		// inverse for down
		if (direction === 'down' && distance > 0) {
			isRangeInDirection = false;
		}
		updates[element.id] = distance === 0;
		return {
			isInRange,
			wasInRange,
			isRangeInDirection,
		};
	}

	let lastInRangeIndex = -1;
	let isRangeInDirection = true;
	let needToContinueUpdatingInDirection = true;

	// even after the range is no longer in this direction, we need to keep updating until we find an element that was not in range
	while (isRangeInDirection || needToContinueUpdatingInDirection) {
		if (isIndexOutOfBounds(currentIndex)) {
			break;
		}
		const { isInRange, wasInRange, isRangeInDirection: rangeInDirection } = evaluateIndex(currentIndex);
		if (isInRange) {
			lastInRangeIndex = currentIndex;
		}
		// If this one was in range, we need to contine updating so we don't leave loose ends
		needToContinueUpdatingInDirection = wasInRange;
		isRangeInDirection = rangeInDirection;
		updateIndex();
	}

	return {
		updates,
		finalIndex: lastInRangeIndex,
	};
}

function setRange() {
	const bufferAbove = window.innerHeight * 0;
	const bufferBelow = window.innerHeight * 0;
	upperRange = 0 - bufferAbove;
	lowerRange = window.innerHeight + bufferBelow;
}

/**
 * Returns the distance the element is outside of the range, or 0.
 * Negative values indicate the element is above the range, positive values indicate below
 * @param element 
 */
function distanceFromRange(element: HTMLElement): number {
	const rect = element.getBoundingClientRect();
	//       |                  |
	//       -------------------- rect.bottom
	//       ____________________ upperRange
	//       |                  |
	//       -------------------- lowerRange
	//       ____________________ rect.top
	//       |                  |
	const distanceAboveRange = rect.bottom - upperRange; // negative here indicates above range
	const distanceBelowRange = rect.top - lowerRange; // negative here indicates below range
	// console.log('Distance from range:', {
	// 	element,
	// 	rect,
	// 	upperRange,
	// 	lowerRange,
	// 	distanceAboveRange,
	// 	distanceBelowRange,
	// });
	if (distanceAboveRange < 0) {
		return distanceAboveRange;
	}
	if (distanceBelowRange > 0) {
		return distanceBelowRange;
	}
	return 0;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
	if (!element) {
		return null;
	}
	const overflowY = window.getComputedStyle(element).overflowY;
	if (overflowY === 'auto' || overflowY === 'scroll') {
		return element;
	}
	if (!element.parentElement) {
		return null;
	}
	return findScrollParent(element.parentElement);
}

watch(() => ({
	children: wrapper.value?.children,
}), () => {
	debounceUpdate();
}, { immediate: true });

let scroller;
onMounted(() => {
	scroller = findScrollParent(wrapper.value!) || window;
	scroller.addEventListener('scroll', debounceUpdate);
	scroller.addEventListener('resize', debounceUpdate);
});

onBeforeUnmount(() => {
	scroller?.removeEventListener('scroll', debounceUpdate);
	scroller?.removeEventListener('resize', debounceUpdate);
});

</script>

<template>
	<div ref="wrapper" class="lazy-wrapper">
		<slot :inRange="inRangeIds" />
	</div>
</template>

<style scoped>
.lazy-wrapper {
	display: contents;
}
</style>
