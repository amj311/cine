<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import NavModal from './utils/NavModal.vue';
import ToggleSwitch from '@/components/utils/ToggleSwitch.vue';
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '@/stores/user.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import type InputText from 'primevue/inputtext';
import { encodeMediaPath, objectOrder } from '@/utils/miscUtils';

const toast = useToast();
const props = defineProps<{
}>();

const modal = ref<InstanceType<typeof NavModal>>();
const newEmail = ref('');
const isValidEmail = computed(() => newEmail.value.match(/\w+@\w+.\w{2}/g));

defineExpose({
	open: () => {
		modal.value?.open();
		loadSharing();
	},
})

const allShares = ref<Array<{
	emails: Array<string>,
	accessType: 'owner' | 'direct' | 'superset' | 'subset' | 'loan',
	relativePath: string,
}>>([]);

const accessOrder = {
	'direct': 1,
	'superset': 2,
	'subset': 3,
	'loan': 4,
	'owner': 5
}

const accessLabels = {
	'direct': 'Shared',
	'superset': 'Through parent',
	'subset': 'To sub-path',
	'loan': 'On loan',
	'owner': 'Owner'
}

const sharesByPerson = computed(() => {
	const byPerson: Record<string, Array<{ path: string, accessType: string }>> = {};
	for (const share of allShares.value) {
		for (const email of share.emails) {
			const personShares = byPerson[email] || [];
			personShares.push({ path: share.relativePath, accessType: share.accessType });
			byPerson[email] = personShares;
		}
	}
	return objectOrder(Array.from(Object.entries(byPerson)).map(([email, shares]) => {
		const greatestAccess = objectOrder(shares, s => accessOrder[s.accessType])[0];
		return {
			email,
			greatestAccess,
			shares,
			isDirect: greatestAccess.accessType === 'direct',
		}
	}), s => accessOrder[s.greatestAccess.accessType]);
})

const isLoading = ref(false);
const loadError = ref('');

async function loadSharing() {
	isLoading.value = true;
	try {
		const { data } = await useApiStore().api.get(`/share?path=${encodeMediaPath(useQueryPathStore().currentPath)}`);
		allShares.value = data.data || [];
	}
	catch (e) {
		console.error(e);
		loadError.value = 'Failed to load.';
	}
	finally {
		isLoading.value = false;
	}
}

const directShares = computed(() => sharesByPerson.value?.filter(s => s.isDirect) || []);

const isDeletingEmail = ref('');

async function deleteDirectShare(emailToDelete: string) {
	const directShare = allShares.value.find(s => s.relativePath === useQueryPathStore().currentPath && s.emails.includes(emailToDelete));
	if (!directShare) {
		return;
	}

	isDeletingEmail.value = emailToDelete;
	try {
		const newSharedEmails: Array<string> = directShares.value.map(s => s.email).filter(e => e !== emailToDelete);
		await useApiStore().api.post('/share', {
			path: useQueryPathStore().currentPath,
			emails: newSharedEmails,
		})
		directShare.emails = newSharedEmails;
		isDeletingEmail.value = '';
	}
	catch (e) {
		toast.add({
			summary: 'Failed to share with email',
			severity: 'error',
			life: 5000,
		})
	}
	finally {
		isAdding.value = false;
	}
}

const isAdding = ref(false);

async function addShare() {
	const email = newEmail.value;
	if (isAdding.value || !newEmail.value || !isValidEmail.value) {
		return;
	}

	if (directShares.value.some(s => s.email === email)) {
		return;
	}

	isAdding.value = true;
	try {
		const sharedEmails: Array<string> = [email, ...directShares.value.map(s => s.email)];
		await useApiStore().api.post('/share', {
			path: useQueryPathStore().currentPath,
			emails: sharedEmails,
		})
		allShares.value?.push({
			emails: [email],
			relativePath: useQueryPathStore().currentPath,
			accessType: 'direct',
		});
		newEmail.value = '';
	}
	catch (e) {
		toast.add({
			summary: 'Failed to share with email',
			severity: 'error',
			life: 5000,
		})
	}
	finally {
		isAdding.value = false;
	}
}



</script>

<template>
	<NavModal
		ref="modal"
		:width="'25rem'"
		:title="`Share '${useQueryPathStore().currentFile}'`"
	>
		<div class="flex-column gap-3">
			<div class="flex-column gap-2">
				<InputText transparent fluid v-model="newEmail" :invalid="Boolean(newEmail && !isValidEmail)" placeholder="Enter an email to share access with..." enterkeyhint="go" @keypress.enter="addShare" />
				<div v-if="isAdding" class="w-full text-center text-xs">Adding...</div>
			</div>
			
			<div v-if="isLoading" class="p-4">Loading...</div>
			<div v-else-if="allShares.length">
				<div v-for="person in sharesByPerson" class="flex-column gap-1" :class="{ 'text-400 py-2': !person.isDirect }">
					<div class="flex-row-center overflow-hidden w-full">
						<div class="text-ellipsis">{{ person.email }}</div>
						<div class="flex-grow-1" />
						<template v-if="person.isDirect">
							<Button small text severity="secondary" :icon="isDeletingEmail === person.email ? 'pi pi-spin pi-spinner' : 'pi pi-trash'" @click="deleteDirectShare(person.email)" />
						</template>
						<template v-else>
							<div class="text-sm">{{ accessLabels[person.greatestAccess.accessType] }}</div>
						</template>
					</div>
					<div v-if="!person.isDirect" class="text-right cursor-pointer" @click="useQueryPathStore().goTo(person.greatestAccess.path)">
						<small><i><a>{{ person.greatestAccess.path }}</a></i></small>
					</div>
				</div>
			</div>
			<div v-else>
				Not yet shared with anyone.
			</div>
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
