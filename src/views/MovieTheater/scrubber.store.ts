import { computed, ref, watch, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { useApiStore } from '@/stores/api.store';
import { msToSec, secToMs } from '@/utils/miscUtils';
import { v4 as uuid } from 'uuid';

export type Scrub = {
	scrub_id: string, // uuid for scrub identification
	start_time_ms: number,
	end_time_ms: number,
	skip?: boolean,
	mute?: boolean,
	overlay?: boolean,
}

type ScrubTarget = {
	name: string,
	year?: string,
	seasonNumber?: number,
	episodeNumber?: number,
	version?: string,
}

function createTargetForMedia(media): ScrubTarget {
	return {
		name: media.seriesName || media.name, // use seriesName for episodes, or just name for others
		year: media.year || undefined,
		seasonNumber: media.seasonNumber || undefined,
		episodeNumber: media.episodeNumber || undefined,
		version: media.version || undefined,
	};
}

export const useScrubberStore = defineStore('Scrubber', () => {
	const isScrubbing = ref<boolean>(false);
	const relativePath = ref<string>('');

	const loadingProfile = ref(false);
	const savingProfile = ref(true);
	const activeProfile = ref<{ target: any, scrubs: Array<Scrub> } | null>(null);
	const scrubs = computed(() => activeProfile.value?.scrubs.sort((a, b) => a.start_time_ms - b.start_time_ms) || []);
	watch(() => scrubs, scheduleScrub, { deep: true });

	const savedProfile = ref('');
	const hasChanges = computed(() => savedProfile.value && activeProfile.value && JSON.stringify(activeProfile.value) !== savedProfile.value);

	const nextScrub = ref<Scrub | null>(null);
	let scheduledTimeout: ReturnType<typeof setTimeout> = 0;
	let mediaEl = ref<HTMLVideoElement | null>(null);

	async function loadProfileForPath() {
		try {
			loadingProfile.value = true;
			const { data } = await useApiStore().api.get('/scrub/media?relativePath=' + relativePath.value);
			activeProfile.value = data.data;
			savedProfile.value = JSON.stringify(activeProfile.value);
			if (scrubs.value.length > 0) {
				startScrubbing();
			}
		}
		finally {
			loadingProfile.value = false;
		}
	}

	async function saveProfile() {
		try {
			savingProfile.value = true;
			await useApiStore().api.put('/scrub', activeProfile.value);
			savedProfile.value = JSON.stringify(activeProfile.value);
		}
		finally {
			savingProfile.value = false;
		}
	}

	function setupMediaRef(newMediaEl: HTMLVideoElement) {
		if (mediaEl.value) {
			// remove listeners
			mediaEl.value.removeEventListener('play', scheduleScrub);
			mediaEl.value.removeEventListener('pause', cancelScrub);
		}

		mediaEl.value = newMediaEl;
		mediaEl.value.addEventListener('play', scheduleScrub);
		mediaEl.value.addEventListener('pause', cancelScrub);
	}


	function startScrubbing() {
		isScrubbing.value = true;
		scheduleScrub();
	}

	/** Scrubbing will continue, but the current timeout will be cleared */
	function cancelScrub() {
		nextScrub.value = null;
		clearTimeout(scheduledTimeout);
	}

	function scheduleScrub() {
		if (!isScrubbing.value || !mediaEl || !activeProfile.value || activeProfile.value.scrubs.length === 0) {
			return;
		}
		if (scheduledTimeout) {
			clearTimeout(scheduledTimeout);
		}
		// Get the scrub with the soonest start time
		nextScrub.value = scrubs.value.find(scrub => scrub.start_time_ms >= getMediaMs()) || null;
		if (nextScrub.value) {
			scheduledTimeout = setTimeout(doScrub, nextScrub.value.start_time_ms - getMediaMs());
		}
		console.log("Next scrub", nextScrub.value);
	}

	/** Schedule to be called at the moment the media hits the scrub start time */
	function doScrub() {
		if (!mediaEl.value) {
			return;
		}
		if (!nextScrub.value) {
			console.warn('No next scrub')
			return;
		}
		// if (mediaEl?.currentTime !== nextScrub.value.start_time) {
		// 	console.warn('Media time is not at scrub time! Looking for next scrub');
		// 	scheduleScrub();
		// 	return;
		// }

		mediaEl.value.currentTime = msToSec(nextScrub.value.end_time_ms);
		scheduleScrub();
	}

	function getMediaMs() {
		return mediaEl.value ? secToMs(mediaEl.value.currentTime) : 0;
	}

	return {
		isScrubbing,
		loadingProfile,
		activeProfile,
		nextScrub,
		scrubs,
		mediaEl,

		startScrubbing,
		toggleScrubbing() {
			if (isScrubbing.value) {
				cancelScrub();
				isScrubbing.value = false;
			}
			else {
				startScrubbing();
			}
		},

		async initForMedia(path: string, media: HTMLVideoElement) {
			relativePath.value = path;
			await loadProfileForPath();
			setupMediaRef(media);
		},

		createProfileForMedia(media) {
			const target = createTargetForMedia(media);
			activeProfile.value = {
				target,
				scrubs: [],
			}
			startScrubbing();
		},

		scheduleScrub,
		hasChanges,
		restoreProfile() {
			activeProfile.value = JSON.parse(savedProfile.value || 'null');
		},
		saveProfile,
	}
})
