<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Scroll from './Scroll.vue';

export type VirtualScrollRow = {
	height: number;
	key?: string;
	data?: any;
};

type VirtualScrollRowWithPosition = {
	top: number;
	topPercent: number;
	bottom: number;
} & VirtualScrollRow;

const props = defineProps<{
	rows: Array<VirtualScrollRow>;
}>();

const wrapper = ref<HTMLDivElement>();
const scrollerRef = ref<InstanceType<typeof Scroll>>();
const scrollArea = computed(() => scrollerRef.value?.scrollArea);

const totalHeight = ref(0);
const allRows = computed<Array<VirtualScrollRowWithPosition>>(() => {
	let accHeight = 0;
	const rows = props.rows.map((row) => {
		accHeight += row.height;
		return {
			...row,
			top: accHeight - row.height,
			topPercent: ((accHeight - row.height) / totalHeight.value) * 100,
			bottom: accHeight,
		};
	});
	totalHeight.value = accHeight;
	console.log('All rows:', rows);
	return rows;
});

const updateDelay = 500;
let lastBounceTime = 0;

const updateTimeout = ref<number | null>(null);
function debounceUpdate() {
	lastBounceTime = Date.now();
	if (!updateTimeout.value) {
		updateTimeout.value = window.setTimeout(() => {
			updateScrollRange();
			updateTimeout.value = null;
			// If the last bounce time is more than the delay, we can safely assume that the user has stopped scrolling
			if (lastBounceTime + updateDelay < Date.now()) {
				// debounceUpdate();
			}
		}, updateDelay);
	}
	
}

const inRangeRows = ref<Array<VirtualScrollRowWithPosition>>([]);
let previousFinalSearchIndex = 0;
let upperRange = 0;
let lowerRange = 0;

function updateScrollRange() {
	if (!wrapper.value) {
		return;
	}
	if (!allRows) {
		return;
	}
	setRange();
	const startingIndex = Math.min(previousFinalSearchIndex, allRows.value.length - 1);

	// Scan updates in both directions from the starting index
	const { foundRows: upRows, finalIndex: upFinalIndex } = updateInDirection('up', startingIndex);
	const { foundRows: downRows, finalIndex: downFinalIndex } = updateInDirection('down', startingIndex + 1);

	if (upFinalIndex !== -1) {
		previousFinalSearchIndex = upFinalIndex;
	}
	else if (downFinalIndex !== -1) {
		previousFinalSearchIndex = downFinalIndex;
	}
	else {
		previousFinalSearchIndex = 0;
	}
	
	inRangeRows.value = [...upRows, ...downRows].sort((a, b) => {
		return a.top - b.top;
	});
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
) {
	// start at the starting index
	let currentIndex = startingIndex;
	const foundRows: Array<VirtualScrollRowWithPosition> = [];

	function updateIndex() {
		if (direction === 'up') {
			currentIndex--;
		}
		else {
			currentIndex++;
		}
	}

	function isIndexOutOfBounds(index: number): boolean {
		if (index < 0 || index >= allRows.value.length) {
			return true;
		}
		return false;
	}

	function evaluateIndex(index: number) {
		if (!allRows.value) {
			return {
				isInRange: false,
				wasInRange: false,
				isRangeInDirection: false,
			};
		}
		const row = allRows.value[index];
		const distance = distanceFromRange(row);
		const isInRange = distance === 0;
		let isRangeInDirection = true;
		// if the element is above range and the direction is up, then range is not in this direction
		if (direction === 'up' && distance < 0) {
			isRangeInDirection = false;
		}
		// inverse for down
		if (direction === 'down' && distance > 0) {
			isRangeInDirection = false;
		}
		if (isInRange) {
			foundRows.push(row);
		}
		return {
			isInRange,
			isRangeInDirection,
		};
	}

	let lastInRangeIndex = -1;
	let isRangeInDirection = true;

	// even after the range is no longer in this direction, we need to keep updating until we find an element that was not in range
	while (isRangeInDirection) {
		if (isIndexOutOfBounds(currentIndex)) {
			break;
		}
		const { isInRange, isRangeInDirection: rangeInDirection } = evaluateIndex(currentIndex);
		if (isInRange) {
			lastInRangeIndex = currentIndex;
		}
		// If this one was in range, we need to contine updating so we don't leave loose ends
		isRangeInDirection = rangeInDirection;
		updateIndex();
	}

	return {
		foundRows,
		finalIndex: lastInRangeIndex,
	};
}

function setRange() {
	if (!scrollArea.value) {
		return;
	}
	const rect = scrollArea.value.getBoundingClientRect();
	const bufferAbove = rect.height * 0;
	const bufferBelow = rect.height * 0;
	upperRange = 0 - bufferAbove;
	lowerRange = rect.height + bufferBelow;
}

/**
 * Returns the distance the element is outside of the range, or 0.
 * Negative values indicate the element is above the range, positive values indicate below
 * @param element 
 */
function distanceFromRange(row: VirtualScrollRowWithPosition): number {
	const scrollTop = scrollArea.value?.scrollTop ?? 0;
	//       |                  |
	//       -------------------- row.bottom
	//       ____________________ upperRange
	//       |                  |
	//       -------------------- lowerRange
	//       ____________________ row.top
	//       |                  |
	const distanceAboveRange = row.bottom - scrollTop - upperRange; // negative here indicates above range
	const distanceBelowRange = row.top - scrollTop - lowerRange; // negative here indicates below range
	// console.log('Distance from range:', {
	// 	element,
	// 	row,
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

onMounted(() => {
	scrollArea.value?.addEventListener('scroll', debounceUpdate);
	scrollArea.value?.addEventListener('resize', debounceUpdate);
	debounceUpdate();
});

onBeforeUnmount(() => {
	scrollArea.value?.removeEventListener('scroll', debounceUpdate);
	scrollArea.value?.removeEventListener('resize', debounceUpdate);
});

defineExpose({
	allRows,
	inRangeRows,
	scrollArea,
	scrollToRow(row: VirtualScrollRowWithPosition) {
		if (!scrollArea.value) {
			return;
		}
		scrollArea.value.scrollTo({
			top: row.top,
			behavior: 'smooth',
		});
	}
})

</script>

<template>
	<div style="height: 100%">
		<Scroll ref="scrollerRef">
			<div ref="wrapper" class="lazy-wrapper" :style="{ height: totalHeight + 'px' }">
				<div v-for="row in inRangeRows" :key="row.key" class="row-wrapper" :style="{ height: row.height + 'px', top: row.top + 'px' }">
					<slot name="row" :data="row.data" />
				</div>
			</div>
		</Scroll>
	</div>
</template>

<style scoped>
.lazy-wrapper {
	position: relative;

	.row-wrapper {
		position: absolute;
		width: 100%;
	}
}
</style>
