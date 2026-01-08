<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import GalleryFileFrame, { type GalleryFile } from '@/components/GalleryFileFrame.vue';
import Slideshow from '@/components/Slideshow.vue';
import VirtualScroll, { type VirtualScrollRow, type VirtualScrollRowWithPosition } from '@/components/VirtualScroll.vue';
import Scroll from '@/components/Scroll.vue';
import { useScreenStore } from '@/stores/screen.store';

const { files = [] } = defineProps<{
	files: Array<GalleryFile>; // libraryItem
}>();

const timelineMonths = ref<Array<{date: string, items: Array<GalleryFile>}>>([]);

function computeTimelineMonths() {
	const days: Record<string, Array<GalleryFile>> = {};
	const unknown: Array<GalleryFile> = [];
	files.forEach((file) => {
		if (!file.takenAt) {
			unknown.push(file);
			return;
		}
		// get date format like May, 2025
		const itemDateString = new Date(file.takenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
		if (!days[itemDateString]) {
			days[itemDateString] = [];
		}
		days[itemDateString].push(file);
	});

	const daysArray = Object.entries(days).map(([date, items]) => ({
		date,
		items: items.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()),
	})).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	if (unknown.length > 0) {
		daysArray.push({
			date: 'Unknown Date',
			items: unknown,
		});
	}

	timelineMonths.value = daysArray;
};

watch(() => files, computeTimelineMonths, { immediate: true, deep: true });

const startRowIdx = ref(0);
const maxCurrentItems = 300;

const currentMonths = computed(() => {
	if (!timelineMonths.value.length) return [];

	const rows = [] as typeof timelineMonths.value;
	let currentIdx = startRowIdx.value;
	let totalItems = 0;
	do {
		rows.push(timelineMonths.value[currentIdx]);
		totalItems += timelineMonths.value[currentIdx].items.length;
		currentIdx++;
	} while (currentIdx < timelineMonths.value.length && totalItems < maxCurrentItems);
	
	return rows;
});

const previousMonths = computed(() => timelineMonths.value.slice(Math.max(0, startRowIdx.value - 3), startRowIdx.value));
const nextMonths = computed(() => timelineMonths.value.slice(startRowIdx.value + currentMonths.value.length, startRowIdx.value + currentMonths.value.length + 3));

const itemsPerRow = ref(7);
const imageHeight = ref(0);

function determineItemsPerRow() {
	let newValue = 7;
	const breakpoints = [
		{ width: 1280, items: 7 },
		{ width: 1024, items: 5 },
		{ width: 768, items: 3 },
	];
	breakpoints.forEach((breakpoint) => {
		if (window.innerWidth <= breakpoint.width) {
			newValue = breakpoint.items;
		}
	});
	itemsPerRow.value = newValue;
	imageHeight.value = (virtualScroller.value?.scrollArea?.clientWidth || window.innerWidth) / itemsPerRow.value;
}

onBeforeMount(() => {
	determineItemsPerRow();
	window.addEventListener('resize', determineItemsPerRow);
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', determineItemsPerRow);
})

const virtualMonthRows = computed<Array<VirtualScrollRow>>(() => {
	const rows: Array<VirtualScrollRow> = [];
			
	currentMonths.value.forEach((day) => {
		rows.push({
			height: 100,
			key: day.date.replaceAll(' ', '-') + 'header',
			persist: true,
			data: {
				isHeader: true,
				date: day.date,
			},
		});

		const rowCount = Math.ceil(day.items.length / itemsPerRow.value);
		for (let i = 0; i < rowCount; i++) {
			const start = i * itemsPerRow.value;
			const end = Math.min(start + itemsPerRow.value, day.items.length);
			const items = day.items.slice(start, end);
			rows.push({
				height: imageHeight.value,
				key: day.date + 'row' + i,
				data: {
					isHeader: false,
					date: day.date,
					items,
				},
			});
		}
	});

	return rows;
});


// TRACK ANCHORS!
const virtualScroller = ref<InstanceType<typeof VirtualScroll>>();
const trackAnchors = computed(() => virtualScroller.value?.allRows.filter((row) => row.data.isHeader).map((row) => {
	return {
		row,
		percent: row.topPercent,
		fromTop: row.top,
		label: row.data.date,
	};
}).filter(Boolean) || []);

function goToMonth(monthDate: string, behavior: ScrollBehavior = 'smooth') {
	const anchor = trackAnchors.value.find(a => a.label === monthDate);
	if (anchor) {
		return scrollToAnchor(anchor, behavior);
	}

	// otherwise make desired month the new start of current months
	const monthIdx = timelineMonths.value.findIndex(m => m.date === monthDate);
	startRowIdx.value = Math.max(0, monthIdx);
	
	// scroll to new anchor without animation since the direction could be non-intuitive
	nextTick(() => goToMonth(monthDate, 'instant'));
}

function scrollToAnchor(anchor: typeof trackAnchors.value[0], behavior: ScrollBehavior = 'smooth') {
	virtualScroller.value?.scrollToRow(anchor.row, behavior);
}


const topLabel = ref<VirtualScrollRowWithPosition | null>(null);

function findTopLabel() {
	if (!virtualScroller.value?.scrollArea) {
		return;
	}
	const scrollBottom = (virtualScroller.value.scrollArea.scrollTop || 0) + (virtualScroller.value.scrollArea.clientHeight || 0)/2;
	topLabel.value = virtualScroller.value.persistRows.find((row, i, rows) => {
		// find the first where the next is below the scroll bottom
		const next = rows[i + 1];
		return !next || next.top > scrollBottom;
	}) || null;
}



const showClosestLabel = ref(false);
const showClosestLabelTime = 2000;
const hideClosestLabelTimeout = ref<number | null>(null);
function doShowClosestLabel() {
	if (hideClosestLabelTimeout.value) {
		clearTimeout(hideClosestLabelTimeout.value);
	}
	showClosestLabel.value = true;
	hideClosestLabelTimeout.value = window.setTimeout(() => {
		showClosestLabel.value = false;
	}, showClosestLabelTime);
}

watch(() => topLabel.value?.data?.date, (newValue) => {
	if (newValue) {
		doShowClosestLabel();
		const anchorEl = document.getElementById('sidebar_button__' + normLabel(topLabel.value?.data?.date));
		if (anchorEl) {
			// scroll to el but leave buffer at top
			sidebarScrollRef.value?.scrollArea?.scrollTo({ top: anchorEl?.getBoundingClientRect().top - 200, behavior: 'smooth' })
		}
	}
});

const sidebarScrollRef = ref<InstanceType<typeof Scroll>>();

const slideshow = ref<InstanceType<typeof Slideshow>>();
function openSlideshow(file: GalleryFile) {
	const filesInOrder = timelineMonths.value.flatMap((day) => day.items);
	slideshow.value?.open(filesInOrder, file);
}

const showMenu = ref(false);
function openSidebar() {
	if (!showMenu.value) {
		showMenu.value = true;
	}
}

function normLabel(date) {
	return date.replaceAll(/[\W]/g, '');
}

</script>

<template>
	<div class="gallery-timeline">
		<div class="gallery-side" @click="showMenu = false">
			<VirtualScroll v-if="virtualMonthRows && virtualMonthRows.length > 0" ref="virtualScroller" :rows="virtualMonthRows" :onScroll="findTopLabel">
				<template #before>
					<div v-if="previousMonths.length" class="flex-row-center justify-content-end flex-wrap gap-2 pr-2">
						Go to: <Button v-for="month in previousMonths" severity="secondary" @click="goToMonth(month.date)" :label="month.date" />
					</div>
				</template>

				<template #row="{ data }" :key="day.date" class="date-row" :data-track-anchor="day.date">
					<div class="pl-2 pb-2 pr-2 flex h-full">
						<h2 v-if="data.isHeader" class="mt-7">{{ data.date }}</h2>
						<div v-else class="photo-grid" :style="{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }">
							<div
								class="photo-cell lazy-load"
								tabindex="0"
								v-for="file in data.items"
								:key="file.relativePath"
								:id="file.relativePath"
								@click="openSlideshow(file)"
								data-tvNavJumpRow="photo_menu"
							>
								<GalleryFileFrame :file="file" :objectFit="'cover'" :hide-controls="true" :size="'small'" :thumbnail="true" />
								<div class="overlay">
									<i v-if="file.fileType === 'video'" class="play-icon pi pi-play" />
								</div>
							</div>
						</div>
					</div>
				</template>

				<template #after>
					<div v-if="nextMonths.length" class="flex-row-center justify-content-end flex-wrap gap-2 py-5 pr-2">
						Go to: <Button v-for="month in nextMonths" severity="secondary" @click="goToMonth(month.date)" :label="month.date" />
					</div>
				</template>
			</VirtualScroll>
		</div>

		<div class="track" @click="openSidebar" @touchstart="openSidebar">
			<div class="track-anchor-item"
				v-for="(anchor, i) in trackAnchors"
				:style="{ top: anchor.percent + '%', height: ((trackAnchors[i+1]?.percent || 100) - anchor.percent) + '%' }"
			>
				<div class="tick"></div>
			</div>
			<div class="label scroll-marker" v-show="showClosestLabel && topLabel" :style="{ top: topLabel?.topPercent + '%' }">
				{{ topLabel?.data.date }}
			</div>
		</div>

		<div class="menu-wrapper relative overflow-hidden w-10rem" :class="{ 'pointer-events-none': false, 'open': showMenu, 'do-hiding': useScreenStore().isSkinnyScreen }" @mouseleave="showMenu = false">
			<div class="menu h-full border-round-xl absolute w-10rem right-0">
				<div v-if="useScreenStore().isSkinnyScreen" class="flex justify-content-end"><Button @click="showMenu = false" icon="pi pi-arrow-right" text severity="secondary" /></div>
				<Scroll ref="sidebarScrollRef">
					<div class="flex flex-column align-items-end px-2">
						<Button v-for="month in timelineMonths"
							:key="month.date"
							:id="'sidebar_button__' + normLabel(month.date)"
							:variant="month.date === topLabel?.data?.date ? 'outlined' : 'text'"
							severity="contrast"
							tabindex="0"
							@click.stop="() => { goToMonth(month.date); (showMenu = false) }"
							data-tvNavJumpRow="photo_menu"
						>
							<div class="white-space-nowrap">{{ month.date }}</div>
						</Button>
					</div>
				</Scroll>
			</div>
		</div>
	</div>

	<Slideshow ref="slideshow" />
</template>

<style scoped lang="scss">
.gallery-timeline {
	--track-width: 20px;
	height: 100%;
	position: relative;
	display: flex;
	
	.gallery-side {
		position: relative;
		height: 100%;
		flex: 1 1;

		.gallery {
			padding: 5px;
		}
	}

}

.menu-wrapper {
	position: relative;
	transition: 500ms;
	max-width: 100vw !important;

	&.do-hiding:not(.open) {
		max-width: 0 !important;
	}
}


.track {
	position: relative;
	top: 0;
	right: 0;
	height: 100%;
	width: var(--track-width);
	margin-left: calc(-1 * var(--track-width) + 10px);

	.track-anchor-item {
		position: absolute;
		right: 0;
		width: 100%;
		white-space: nowrap;

		.tick {
			position: absolute;
			top: 0;
			left: 50%;
			translate: -50% 0;
			width: 4px;
			aspect-ratio: 1;
			border-radius: 50%;
			background-color: var(--color-contrast);
		}
	}

	.scroll-marker {
		position: absolute;
		top: 0;
		left: 0;
		translate: -100% 0;
		background-color: var(--color-background-soft);
		box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.5);
		color: var(--color-contrast);
		padding: 5px;
		border-radius: 5px;
		font-size: 1.2em;
		text-align: center;
		pointer-events: none;
		white-space: nowrap;
		transition: all 500ms ease-in-out;
	}
}


.photo-grid {
	display: grid;
	gap: 10px;
	height: 100%;
	width: 100%;

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
