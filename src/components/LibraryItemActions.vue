<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import type SurpriseModal from '@/components/SurpriseModal.vue';
import { useToast } from 'primevue/usetoast';
import { useApiStore } from '@/stores/api.store';
import { encodeMediaPath } from '@/utils/miscUtils';
import { useRouter } from 'vue-router';
import { useWatchProgressStore } from '@/stores/watchProgress.store';

const toast = useToast();
const router = useRouter();

const { libraryItem, reload } = defineProps<{
	libraryItem: any; // libraryItem
	reload?: () => void,
}>();

const mainMediaTypes = ['cinema', 'audiobook', 'audio'];

const canSurprise = computed(() => {
	return mainMediaTypes.includes(libraryItem.type);
})
const canRefresh = computed(() => {
	return mainMediaTypes.includes(libraryItem.type);
})

const playableObject = computed(() => {
	if (libraryItem.cinemaType === 'movie') {
		return libraryItem.movie;
	}
	else if (libraryItem.cinemaType !== 'series') {
		return libraryItem;
	}
})

const surpriseModal = ref<InstanceType<typeof SurpriseModal>>();

function doReload() {
	if (reload) {
		reload();
	}
	else location.reload();
}

const menuItems = computed(() => [
	canSurprise.value && {
		label: 'Surprise',
		icon: 'pi pi-gift',
		command: () => {
			surpriseModal.value?.open();
		},
	},
	canRefresh.value && {
		label: 'Refresh',
		icon: 'pi pi-replay',
		command: async () => {
			const pendingMessage = {
				severity: 'info',
				summary: 'Refreshing item data...',
				detail: 'File contents and metadata will be updated.'
			};
			try {
				toast.add(pendingMessage);
				await useApiStore().api.post('/refresh?path=' + encodeMediaPath(libraryItem.relativePath));
				toast.add({
					severity: 'success',
					summary: 'Refreshed!',
				})
				doReload();
			}
			catch (e) {
				console.error(e);
				toast.add({
					severity: 'error',
					summary: 'Failed to refresh data',
				})
			}
			finally {
				toast.remove(pendingMessage);
			}
		},
	},
	playableObject.value?.watchProgress && {
		label: 'Clear Watch History',
		icon: 'pi pi-eraser',
		command: async () => {
			const pendingMessage = {
				severity: 'info',
				summary: 'Removing watch progress...',
			};
			try {
				toast.add(pendingMessage);
				await useWatchProgressStore().removeProgress(playableObject.value?.relativePath);
				toast.add({
					severity: 'success',
					summary: 'Removed watch progress!',
				})
				doReload();
			}
			catch (e) {
				console.error(e);
				toast.add({
					severity: 'error',
					summary: 'Failed to remove watch progress',
				})
			}
			finally {
				toast.remove(pendingMessage);
			}
		},
	}
].filter(Boolean));

defineExpose({
	menuItems,
})

</script>

<template>
	<DropdownMenu :items="menuItems" />
	<SurpriseModal ref="surpriseModal" :libraryItem="libraryItem" />
</template>

<style
	lang="scss"
	scoped
>
.album-page {
	display: flex;
	flex-direction: column;
	gap: 1em;
	height: 100%;
	min-height: 0;
	max-height: 100%;
	overflow: hidden;

	.top-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1em;
   		padding: 0 2em;
    	flex: 1 0 10vw;
	}

	.other-wrapper {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 1em;
		height: 100%;
		max-height: 100%;
		min-height: 0;
	}
}

/* landscape screens */
@media (min-aspect-ratio: 1/1) {
	.album-page {
		flex-direction: row;
		align-items: center;
		padding-left: 1rem;
	}
}


.poster-wrapper {
	width: min(100%, 20rem);
}

.chapters-list-wrapper {
	flex-grow: 1;
	min-width: 0;
	overflow: hidden;
}

.chapter-item {
	font-size: 1.2rem;
	display: grid;
	grid-template-columns: 1em 1em 1fr auto;
	align-items: center;
	gap: .5rem;
	padding: 0.8em 0.7em;
	cursor: pointer;

	
	&.active {
		background-color: #fff1;
		.title { font-weight: bold; }
	}
	&:hover {
		background-color: #fff2;
	}

	.number {
		text-align: right;
		opacity: .7;
	}

	.title {
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.duration {
		text-align: right;
		opacity: .7;
	}
}

.audio-controls {
	audio {
		width: 100%;
	}
}
</style>
