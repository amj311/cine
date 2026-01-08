<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import GalleryFileFrame, { type GalleryFile } from '@/components/GalleryFileFrame.vue';
import Slideshow from '@/components/Slideshow.vue';
import VirtualScroll, { type VirtualScrollRow, type VirtualScrollRowWithPosition } from '@/components/VirtualScroll.vue';
import Scroll from '@/components/Scroll.vue';
import { useScreenStore } from '@/stores/screen.store';
import PhotoTimelineView from './PhotoTimelineView.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
}>();

const allItems = ref<any[]>([]);
const allFiles = ref<GalleryFile[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get(`/rootLibrary/${props.libraryItem.relativePath}/flat`);
		allItems.value = data.data?.items || [];
		allFiles.value = data.data?.files || [];
		computeTimelineDays();
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(async () => {
	await loadItems();
});

const timelineDays = ref<Array<{date: string, items: Array<GalleryFile>}>>([]);
function computeTimelineDays() {
	const days: Record<string, Array<GalleryFile>> = {};
	const unknown: Array<GalleryFile> = [];
	allFiles.value.forEach((file) => {
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

	timelineDays.value = daysArray;
};

const itemsPerRow = ref(3);
const timelineRows = computed<Array<VirtualScrollRow>>(() => {
	const rows: Array<VirtualScrollRow> = [];
	
	const breakpoints = [
		{ width: 1280, items: 7 },
		{ width: 1024, items: 5 },
		{ width: 768, items: 3 },
	];
	breakpoints.forEach((breakpoint) => {
		if (window.innerWidth <= breakpoint.width) {
			itemsPerRow.value = breakpoint.items;
		}
	});
	const imageHeight = (virtualScroller.value?.scrollArea?.clientWidth || window.innerWidth) / itemsPerRow.value;
		
	timelineDays.value.forEach((day) => {
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
				height: imageHeight,
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
})


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

function scrollToAnchor(anchor) {
	virtualScroller.value?.scrollToRow(anchor.row);
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
	const filesInOrder = timelineDays.value.flatMap((day) => day.items);
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
	<div class="photos-page">
		<PhotoTimelineView :files="allFiles" />
	</div>
</template>

<style scoped lang="scss">
.photos-page {
	height: 100%;
	padding-left: 5px;
}
</style>
