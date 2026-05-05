<script setup lang="ts">
import { ref, computed } from 'vue';
import NavModal from './utils/NavModal.vue';
import SourceList from './utils/SourceList.vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { useProfileStore, type Profile, type NowPlayingConfig, type NowPlayingSource, type ProfileMode } from '@/stores/profile.store';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const modeOptions = [
	{ label: 'Full', value: 'full' },
	{ label: 'Theater', value: 'theater' },
];

function makeEmptySource(): NowPlayingSource {
	return { directory: '', count: 1, filter: null };
}

function sourcesToConfig(
	sources: NowPlayingSource[],
	overrides: { day: number; sources: NowPlayingSource[] }[],
): NowPlayingConfig {
	const dayOverrides: NowPlayingConfig['dayOverrides'] = {};
	for (const entry of overrides) {
		dayOverrides[entry.day] = entry.sources.length ? entry.sources.map((s) => ({ ...s })) : null;
	}
	return {
		defaultSources: sources.map((s) => ({ ...s })),
		dayOverrides,
	};
}

const modal = ref<InstanceType<typeof NavModal>>();
const toast = useToast();
const profileStore = useProfileStore();

// ── Form state ────────────────────────────────────────────
type FormMode = 'add' | 'edit';
const formMode = ref<FormMode>('add');
const editingId = ref<string | null>(null);

const name = ref('');
const mode = ref<ProfileMode>('full');
const sources = ref<NowPlayingSource[]>([makeEmptySource()]);
const dayOverrides = ref<{ day: number; sources: NowPlayingSource[] }[]>([]);
const newOverrideDay = ref<number | null>(null);
const saving = ref(false);

const title = computed(() => formMode.value === 'add' ? 'New Profile' : 'Edit Profile');

const availableDayOptions = computed(() =>
	DAY_NAMES.map((label, value) => ({ label, value })).filter(
		({ value }) => !dayOverrides.value.some((o) => o.day === value),
	),
);

function addDayOverride() {
	if (newOverrideDay.value === null) return;
	dayOverrides.value.push({ day: newOverrideDay.value, sources: [makeEmptySource()] });
	newOverrideDay.value = null;
}
function removeDayOverride(i: number) {
	dayOverrides.value.splice(i, 1);
}

function resetState() {
	editingId.value = null;
	name.value = '';
	mode.value = 'full';
	sources.value = [makeEmptySource()];
	dayOverrides.value = [];
	newOverrideDay.value = null;
	saving.value = false;
}

async function submit() {
	if (!name.value.trim()) return;
	saving.value = true;
	try {
		const config: NowPlayingConfig | undefined =
			mode.value === 'theater' ? sourcesToConfig(sources.value, dayOverrides.value) : undefined;
		if (formMode.value === 'add') {
			await profileStore.createProfile(name.value.trim(), mode.value, config);
			toast.add({ severity: 'success', summary: 'Profile created', life: 2500 });
		} else {
			await profileStore.updateProfile(editingId.value!, { name: name.value.trim(), mode: mode.value, nowPlayingConfig: config });
			toast.add({ severity: 'success', summary: 'Profile updated', life: 2500 });
		}
		modal.value?.close();
	} catch (e) {
		toast.add({ severity: 'error', summary: formMode.value === 'add' ? 'Failed to create profile' : 'Failed to update profile', life: 3000 });
	} finally {
		saving.value = false;
	}
}

defineExpose({
	openForAdd() {
		resetState();
		formMode.value = 'add';
		modal.value?.open();
	},
	openForEdit(profile: Profile) {
		resetState();
		formMode.value = 'edit';
		editingId.value = profile.id;
		name.value = profile.name;
		mode.value = profile.mode;
		const cfg = profile.nowPlayingConfig;
		sources.value = cfg?.defaultSources?.length ? cfg.defaultSources.map((s) => ({ ...s })) : [makeEmptySource()];
		dayOverrides.value = cfg
			? Object.entries(cfg.dayOverrides)
					.sort(([a], [b]) => Number(a) - Number(b))
					.map(([day, srcs]) => ({
						day: Number(day),
						sources: srcs?.length ? srcs.map((s) => ({ ...s })) : [makeEmptySource()],
					}))
			: [];
		modal.value?.open();
	},
});
</script>

<template>
	<NavModal ref="modal" :width="'36rem'" :title="title">
		<div class="profile-edit-modal">
			<div class="field-row">
				<label>Name</label>
				<InputText transparent v-model="name" placeholder="Profile name" class="w-full" autofocus />
			</div>
			<div class="field-row">
				<label>Mode</label>
				<Select transparent v-model="mode" :options="modeOptions" optionLabel="label" optionValue="value" class="w-full" />
			</div>

			<template v-if="mode === 'theater'">
				<div class="sources-section">
					<div class="sources-header">Default sources</div>
					<SourceList v-model="sources" />
				</div>

				<div class="day-overrides">
					<div class="day-overrides-header">Day overrides</div>
					<div v-for="(override, oi) in dayOverrides" :key="override.day" class="day-override-block">
						<div class="day-override-label">
							<span>{{ DAY_NAMES[override.day] }}</span>
							<Button icon="pi pi-times" severity="secondary" variant="text" size="small" @click="removeDayOverride(oi)" />
						</div>
						<SourceList v-model="override.sources" />
					</div>
					<div class="override-add-row" v-if="availableDayOptions.length > 0">
						<Select transparent v-model="newOverrideDay" :options="availableDayOptions" optionLabel="label" optionValue="value" placeholder="Add day override…" class="day-select" />
						<Button icon="pi pi-plus" severity="secondary" variant="text" :disabled="newOverrideDay === null" @click="addDayOverride" />
					</div>
				</div>
			</template>

			<div class="form-actions">
				<Button label="Cancel" severity="secondary" variant="text" @click="modal?.close()" />
				<Button :label="formMode === 'add' ? 'Create' : 'Save'" :loading="saving" :disabled="!name.trim()" @click="submit" />
			</div>
		</div>
	</NavModal>
</template>

<style scoped lang="scss">
.profile-edit-modal {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.field-row {
	display: grid;
	grid-template-columns: 8rem 1fr;
	align-items: center;
	gap: 0.75rem;

	label {
		font-size: 0.9rem;
		opacity: 0.8;
	}
}

.sources-section {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;

	.sources-header {
		font-weight: 600;
		font-size: 0.8rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
}

.day-overrides {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;

	.day-overrides-header {
		font-weight: 600;
		font-size: 0.8rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
}

.day-override-block {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	padding: 0.5rem;
	border-radius: 4px;
	background: #ffffff08;
	border: 1px solid #ffffff10;

	.day-override-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.85rem;
		font-weight: 600;
	}
}

.override-add-row {
	display: flex;
	align-items: center;
	gap: 0.4rem;

	.day-select {
		flex: 1;
		min-width: 0;
	}
}

.form-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding-top: 0.25rem;
}
</style>
