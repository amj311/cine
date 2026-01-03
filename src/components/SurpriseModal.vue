<script
	setup
	lang="ts"
>
import { ref } from 'vue';
import { useApiStore } from '@/stores/api.store';
import type Dialog from 'primevue/dialog';
import type ToggleSwitch from 'primevue/toggleswitch';
import type DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import NavModal from './utils/NavModal.vue';

const props = defineProps<{
	libraryItem: any; // libraryItem
}>();

const navModal = ref<InstanceType<typeof NavModal>>();

const draftSurprise = ref(props.libraryItem.surprise || {});
const savingSurprise = ref(false);

async function upsertSurprise() {
	try {
		savingSurprise.value = true;
		await useApiStore().api.post('/surprise', {
			relativePath: props.libraryItem.relativePath,
			record: draftSurprise.value.enabled ? draftSurprise.value : null,
		});
		props.libraryItem.surprise = draftSurprise.value;
	navModal.value?.close();
	}
	catch (e) {
		console.error(e);
	}
	finally {
		savingSurprise.value = false;
	}
}
function cancelSurpriseEdits() {
	draftSurprise.value = props.libraryItem.surprise || {};
	navModal.value?.close();
}

defineExpose({
	open: () => navModal.value?.open(),
})

</script>

<template>
	<NavModal
		ref="navModal"
		:closeable="false"
		:width="'20rem'"
	>
		<template #header>
			<div class="flex align-items-center gap-3 w-full">
				<h3>Keep this a surprise</h3>
				<div class="flex-grow-1" />
				<ToggleSwitch v-model="draftSurprise.enabled" />
			</div>
		</template>

		<p>Hide the details of this media until it is opened, or don't let it open until a future date</p>

		<div
			style="display: grid; grid-template-columns: 1fr 3fr; gap: .5em; align-items: center;"
			:class="{ 'opacity-50 pointer-events-none': !draftSurprise.enabled }"	
		>
			<label>Until</label>
			<div>
				<DatePicker v-model="draftSurprise.until" />
			</div>

			<label>Title</label>
			<div>
				<InputText v-model="draftSurprise.title" placeholder="Surprise!" />
			</div>
			<label>PIN</label>
			<div>
				<InputText v-model="draftSurprise.pin" />
			</div>

		</div>

		<div class="mt-4 flex align-items center justify-content-end">
			<Button label="Cancel" text severity="secondary" @click="cancelSurpriseEdits" />
			<Button label="Save" @click="upsertSurprise" />
		</div>
	</NavModal>
	<!-- <Dialog
		:visible="showSurpriseSettings"
		:closable="false"
		class="w-20rem"
	>
		
	</Dialog> -->
</template>

<style
	lang="scss"
	scoped
>

.show-sm {
	display: none;
}

@media screen and (max-width: 800px) {
	.hide-md {
		display: none;
	}
	.show-sm {
		display: block;
	}

	.title {
		font-size: 1.5em;
	}
}

.cinema-page {
	display: flex;
	flex-direction: column;
	gap: 30px;
}

.top-wrapper {
	display: flex;
	align-items: end;
	gap: 20px;
}

.poster-wrapper {
	width: min(225px, 30vw);
	min-width: min(225px, 30vw);
}

.episode-item {
	display: flex;
	gap: 20px;

	.episode-poster-wrapper {
		width: min(200px, 30vw);
		min-width: min(200px, 30vw);
	}
}
</style>
