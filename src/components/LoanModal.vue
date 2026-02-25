<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import NavModal from './utils/NavModal.vue';
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import { useQueryPathStore } from '@/stores/queryPath.store';
import type InputText from 'primevue/inputtext';
import type Select from 'primevue/select';
import { encodeMediaPath } from '@/utils/miscUtils';

export type Loan = {
	relativePath: string,
	email: string,
	expires: number,
}

type LoanDraft = Partial<Loan>;

const original = defineModel<Loan | null>();

function getDraft() {
	return {
		...(original.value || {}),
		relativePath: useQueryPathStore().currentPath,
	}
}

const draft = ref<LoanDraft>(getDraft());

const toast = useToast();
const props = defineProps<{
}>();

const modal = ref<InstanceType<typeof NavModal>>();
const isValidEmail = computed(() => Boolean(draft.value.email?.match(/\w+@\w+.\w{2}/g)));

defineExpose({
	open: () => {
		modal.value?.open();
	},
})

const expireOptions = computed(() => {
	const now = Date.now();
	const options = [
		{ label: '24 hours', value: now + (1000 * 60 * 60 * 24) },
		{ label: '48 hours', value: now + (1000 * 60 * 60 * 48) },
		{ label: '1 week', value: now + (1000 * 60 * 60 * 48 * 7) },
		{ label: '1 month', value: now + (1000 * 60 * 60 * 48 * 31) },
	];
	if (original.value?.expires) {
		options.unshift({ label: new Date(original.value.expires).toLocaleDateString(), value: original.value.expires });
	}
	return options;
})

const isSaving = ref(false);
async function save() {
	if (!isValidEmail.value || isSaving.value || !draft.value.relativePath) {
		return;
	}
	try {
		isSaving.value = true;
		await useApiStore().api.post('/loan', draft.value);
		original.value = draft.value as Loan;
		await modal.value?.close();
		toast.add({
			life: 5000,
			severity: 'error',
			summary: 'Title loaned!',
		})
	}
	catch (e) {
		console.error(e);
		toast.add({
			life: 5000,
			severity: 'error',
			summary: 'Failed to loan title',
		})
	}
	finally {
		isSaving.value = false;
	}
}

const isDeleting = ref(false);
async function deleteLoan() {
	if (isDeleting.value || !original.value?.relativePath) {
		return;
	}
	try {
		isDeleting.value = true;
		await useApiStore().api.delete('/loan?path=' + encodeMediaPath(original.value.relativePath));
		original.value = null;
		await modal.value?.close();
		toast.add({
			life: 5000,
			severity: 'success',
			summary: 'Loan withdrawn',
		})
	}
	catch (e) {
		console.error(e);
		toast.add({
			life: 5000,
			severity: 'error',
			summary: 'Failed to withdraw loan',
		})
	}
	finally {
		isDeleting.value = false;
	}
}

async function cancel() {
	draft.value = getDraft();
	await modal.value?.close();
}


</script>

<template>
	<NavModal
		ref="modal"
		:width="'25rem'"
		:title="`Loan '${useQueryPathStore().currentFile}'`"
	>
		<div
			style="display: grid; grid-template-columns: 1fr 3fr; gap: .5em; align-items: center;"
		>
			<label>Email</label>
			<div>
				<InputText transparent fluid v-model="draft.email" :invalid="Boolean(draft.email && !isValidEmail)" />
			</div>

			<label>Loan until</label>
			<div>
				<Select transparent fluid v-model="draft.expires" :options="expireOptions" optionLabel="label" optionValue="value" />
			</div>
		</div>

		<div class="mt-4 flex align-items center justify-content-end">
			<Button v-if="original" label="Withdraw" text severity="danger" @click="deleteLoan" />
			<div class="flex-grow-1" />
			<Button label="Cancel" text severity="secondary" @click="cancel" />
			<Button label="Save" @click="save" />
		</div>
	</NavModal>
</template>

<style
	lang="scss"
	scoped
>
.grid-row {
	display: contents;

	&[disabled="true"] * {
		pointer-events: none;
		opacity: .5;
	}
}
</style>
