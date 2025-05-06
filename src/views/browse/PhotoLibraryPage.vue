<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import GalleryFileFrame, { type GalleryFile } from '@/components/GalleryFileFrame.vue';
import Slideshow from '@/components/Slideshow.vue';
import VirtualScroll, { type VirtualScrollRow } from '@/components/VirtualScroll.vue';

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
			key: day.date + 'header',
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

const topRow = computed(() => virtualScroller.value?.inRangeRows[0]);


const showClosestLabel = ref(false);
const showClosestLabelTime = 1000;
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

watch(topRow, (newValue) => {
	if (newValue) {
		doShowClosestLabel();
	}
});

const slideshow = ref<InstanceType<typeof Slideshow>>();
function openSlideshow(file: GalleryFile) {
	const filesInOrder = timelineDays.value.flatMap((day) => day.items);
	slideshow.value?.open(filesInOrder, file);
}

</script>

<template>
	<div class="photos-page">
		<div class="gallery-side">
			<!-- <Scroll ref="scrollerRef">
				<Lazy>
					<template #default="{ inRange }"> -->
						<!-- <div class="gallery flex flex-column gap-6 mt-3" ref="trackWrapper"> -->
							<VirtualScroll ref="virtualScroller" :rows="timelineRows">
								<template #row="{ data }" :key="day.date" class="date-row" :data-track-anchor="day.date">
									<div class="pl-3 pb-2 pr-2 h-full">
										<h2 v-if="data.isHeader" class="mt-7">{{ data.date }}</h2>
										<div v-else class="photo-grid flex flex-row gap-2 h-full">
											<div
												class="photo-cell lazy-load"
												:style="{ height: '100%', width: `${100 / itemsPerRow}%` }"
												tabindex="0"
												v-for="file in data.items"
												:key="file.relativePath"
												:id="file.relativePath"
												@click="openSlideshow(file)"
											>
												<GalleryFileFrame :file="file" :objectFit="'cover'" :hide-controls="true" :size="'small'" :thumbnail="true" />
												<div class="overlay">
													<i v-if="file.fileType === 'video'" class="play-icon pi pi-play" />
												</div>
											</div>
										</div>
									</div>
								</template>
							</VirtualScroll>
						<!-- </div> -->
					<!-- </template> -->
				<!-- </Lazy>
				<br />
			</Scroll> -->
		</div>
		<div class="track">
			<div class="track-anchor-item"
				v-for="(anchor, i) in trackAnchors"
				@click="() => scrollToAnchor(anchor)"
				:style="{ top: anchor.percent + '%', height: ((trackAnchors[i+1]?.percent || 100) - anchor.percent) + '%' }"
				tabindex="0"
			>
				<div class="label">{{ anchor.label }}</div>
				<div class="tick"></div>
			</div>
			<div class="label scroll-marker" v-show="showClosestLabel && topRow" :style="{ top: topRow?.topPercent + '%' }">
				{{ topRow?.data.date }}
			</div>
		</div>
	</div>

	<Slideshow ref="slideshow" />
</template>

<style scoped lang="scss">
.photos-page {
	--track-width: 15px;
	height: 100%;
	position: relative;
	padding-left: 5px;
	
	.gallery-side {
		height: 100%;
		padding-right: calc(var(--track-width) - 5px);

		.gallery {
			padding: 5px;
		}
	}

	.track {
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		width: var(--track-width);

		.track-anchor-item {
			position: absolute;
			right: 0;
			width: 100%;
			white-space: nowrap;
			cursor: pointer;

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
			&:hover, &:focus {
				.label {
					opacity: 1;
				}
			}
		}

		.label {
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
			opacity: 0;
			transition: opacity 0.3s;
			pointer-events: none;
			white-space: nowrap;

			&.scroll-marker {
				opacity: 1;
				transition: all 300ms ease-in-out;
			}
		}
	}
}



.photo-grid {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 10px;

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

		&:hover, &:focus {
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
