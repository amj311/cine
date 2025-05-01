<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
import MediaCard from '@/components/MediaCard.vue';
import MetadataLoader from '@/components/MetadataLoader.vue';
import { useApiStore } from '@/stores/api.store';
import Lazy from '@/components/Lazy.vue';
import Scroll from '@/components/Scroll.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
}>();

const allItems = ref<any[]>([]);
const allFiles = ref<any[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get(`/rootLibrary/${props.libraryItem.relativePath}/flat`);
		allItems.value = data.data?.items || [];
		allFiles.value = data.data?.files || [];
		computeTimelineDays();
		nextTick(() => {
			console.log(getAnchors());
		})
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
onBeforeMount(async () => {
	await loadItems();
});

const timelineDays = ref<Array<{date: string, items: Array<any>}>>([]);
function computeTimelineDays() {
	const days: Record<string, any> = {};
	const unknown: Array<any> = [];
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
			date: 'Unknown',
			items: unknown,
		});
	}

	timelineDays.value = daysArray;
};



// TRACK ANCHORS!
const trackWrapper = ref<HTMLDivElement>();
const trackAnchors = ref<Array<{ percent: number, element: HTMLElement, label: string }>>([]);
function getAnchors() {
	if (!trackWrapper.value) {
		return [];
	}
	const anchorAttr = "data-track-anchor";
	const anchors = Array.from(trackWrapper.value.querySelectorAll(`[${anchorAttr}]`)) as Array<HTMLElement>;
	trackAnchors.value = anchors.filter((child) => Boolean((child as HTMLElement).getAttribute(anchorAttr)))
		.map((anchor) => {
			const rect = anchor.getBoundingClientRect();
			const percent = ((rect.top - trackWrapper.value!.getBoundingClientRect().top) / trackWrapper.value!.clientHeight) * 100;
			return {
				percent,
				element: anchor,
				label: anchor.getAttribute(anchorAttr) || '',
			};
		})
		.sort((a, b) => a.percent - b.percent);
	return trackAnchors.value;
};

const scrollerRef = ref<InstanceType<typeof Scroll>>();
function scrollToAnchor(anchor) {
	if (!anchor.element) {
		return;
	}
	// Scroll scroller to anchor
	const scroller = scrollerRef.value;
	if (!scroller) {
		return;
	}
	const scrollerArea = scroller.scrollArea;
	if (!scrollerArea) {
		return;
	}
	const anchorRect = anchor.element.getBoundingClientRect();
	const scrollerRect = scrollerArea.getBoundingClientRect();
	const scrollTop = anchorRect.top - scrollerRect.top + scrollerArea.scrollTop;
	scrollerArea.scrollTo({
		top: scrollTop,
		behavior: 'smooth',
	});
}

</script>

<template>
		<div class="photos-page">
			<div class="gallery-side">
				<Scroll ref="scrollerRef">
					<Lazy>
						<template #default="{ inRange }">
							<div class="flex flex-column gap-5 mt-3" ref="trackWrapper">
								<div v-for="day in timelineDays" :key="day.date" class="date-row" :data-track-anchor="day.date">
									<h2 class="mb-3" style="position: sticky; top: 0; text-shadow: rgba(0, 0, 0, 0.8) 0px 0px 2px">{{ day.date }}</h2>
									<div class="photo-grid">
										<div v-for="file in day.items" :key="file.relativePath" :id="file.relativePath" class="photo-cell lazy-load" tabindex="0">
											<div v-if="file.type === 'photo' && inRange[file.relativePath]" style="width: 100%; height: 100%;">
												<img 
													:src="useApiStore().baseUrl + '/thumb/' + file.relativePath + '?width=300'" 
													:alt="file.fileName" 
													style="width: 100%; height: 100%; object-fit: cover;" 
												/>
											</div>
										</div>
									</div>
								</div>
							</div>
						</template>
					</Lazy>
					<br />
				</Scroll>
			</div>
			<div class="track">
				<div class="track-anchor-item" v-for="(anchor, i) in trackAnchors" @click="() => scrollToAnchor(anchor)" :style="{ top: anchor.percent + '%', height: ((trackAnchors[i+1]?.percent || 100) - anchor.percent) + '%' }" tabindex="0">
					<div class="label">{{ anchor.label }}</div>
					<div class="tick"></div>
				</div>
			</div>
		</div>
</template>

<style scoped lang="scss">
.photos-page {
	height: 100%;
	position: relative;
	
	.gallery-side {
		height: 100%;
		padding-right: 10px;
	}

	.track {
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		width: 15px;

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
			}
			&:hover .label, &:focus .label {
				opacity: 1;
			}
		}
	}
}



.photo-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
	gap: 10px;

	.photo-cell {
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: var(--color-background-mute);
		border-radius: 5px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	}
}

</style>
