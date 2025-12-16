<script
	setup
	lang="ts"
>
import { ref, computed } from 'vue';
import { type Scrub, useScrubberStore } from './scrubber.store';
import { episodeTag, msToSec, msToTimestamp, secToMs } from '@/utils/miscUtils';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import DurationInput from '@/components/utils/DurationInput.vue';
import { v4 as uuid } from 'uuid';

const scrubStore = useScrubberStore();

const props = defineProps<{
	playable: NonNullable<any>,
}>();

const editingScrubId = ref('');
const editingScrub = computed(() => scrubStore.scrubs.find(s => s.scrub_id === editingScrubId.value));

const hideDurationHour = computed(() => (scrubStore.mediaEl?.duration || 0) < 3600);

function goTo(ms: number) {
	if (scrubStore.mediaEl) {
		scrubStore.mediaEl.currentTime = msToSec(ms);
	}
}

function goToScrubTime(ms: number) {
	if (scrubStore.mediaEl) {
		scrubStore.stopScrubbing();
		goTo(ms);
	}
}

function playScrub(scrub: Scrub) {
	if (scrubStore.mediaEl) {
		goTo(scrub.start_time_ms - 2000);
		scrubStore.startScrubbing();
		scrubStore.mediaEl.play();
	}
}

function addScrub() {
	const startTime = scrubStore.mediaEl ? secToMs(scrubStore.mediaEl.currentTime) : 5000;
	const newId = uuid();
	scrubStore.scrubs.push({
		scrub_id: newId,
		start_time_ms: startTime,
		end_time_ms: startTime + 1000,
	});
	if (scrubStore.mediaEl) {
		scrubStore.mediaEl.pause();
	}
	editingScrubId.value = newId;
}

function deleteScrub(scrub: Scrub) {
	if (scrubStore.activeProfile) {
		scrubStore.activeProfile.scrubs = scrubStore.activeProfile.scrubs.filter(s => s.scrub_id !== scrub.scrub_id);
	}
}

function discardChanges() {
	scrubStore.restoreProfile();
}

</script>

<template>
	<div class="flex flex-column gap-3 h-full">
		<template v-if="scrubStore.loadingProfile">
			<div class="flex flex-column align-items-center justify-content-center h-full gap-3">
				Loading...
			</div>
		</template>

		<template v-else-if="scrubStore.activeProfile">
			<div>
				{{ scrubStore.activeProfile?.target.name }}
				({{ scrubStore.activeProfile?.target.year }})
				{{ !isNaN(scrubStore.activeProfile?.target.episodeNumber) ? episodeTag(scrubStore.activeProfile?.target) : '' }}
			</div>

			<Button outlined icon="pi pi-plus" label="Add Scrub" @click="addScrub" />

			<!-- SCRUBS -->
			<div class="flex-grow-1 overflow-y-auto">
				<Accordion v-model:value="editingScrubId">
					<AccordionPanel v-for="scrub of scrubStore.activeProfile.scrubs" :value="scrub.scrub_id">
						<AccordionHeader>
							<div class="flex align-items-center gap-1 w-full">
								{{ msToTimestamp(scrub.start_time_ms, hideDurationHour) }}
								<div class="flex-grow-1" />
								<Button text severity="secondary" icon="pi pi-play" @click.stop="() => playScrub(scrub)" />
							</div>
						</AccordionHeader>
						<AccordionContent>
							<div class="flex flex-column gap-3">
								<div>
									Start
									<DurationInput
										v-model="scrub.start_time_ms"
										@click="() => goToScrubTime(scrub.start_time_ms)"
									/>
								</div>
								<div>
									End
									<DurationInput
										v-model="scrub.end_time_ms"
										@click="() => goToScrubTime(scrub.end_time_ms)"
										:min="scrub.start_time_ms + 500"
									/>
								</div>
								<div class="flex justify-content-end">
									<Button text severity="secondary" icon="pi pi-trash" label="Delete" @click="deleteScrub(scrub)" />
								</div>
							</div>
						</AccordionContent>
					</AccordionPanel>
				</Accordion>
			</div>

			<div v-if="scrubStore.hasChanges" class="flex align-items-center">
				<span class="text-400">Unsaved changes</span>
				<div class="flex-grow-1" />
				<Button text severity="secondary" label="Discard" @click="discardChanges" />
				<Button label="Save" @click="scrubStore.saveProfile" />
			</div>
		</template>

		<template v-else="scrubStore.activeProfile">
			<div class="flex flex-column align-items-center justify-content-center h-full gap-3">
				<div>No scrub profile found for this media.</div>
				<Button icon="pi pi-plus" label="Start Scrubbing" @click="scrubStore.createProfileForMedia(playable)" />
			</div>
		</template>
	</div>
</template>

<style
	lang="scss"
	scoped
>
</style>
