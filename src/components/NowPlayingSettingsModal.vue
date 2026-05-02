<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import NavModal from './utils/NavModal.vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Button from 'primevue/button';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toast = useToast();
const modal = ref<InstanceType<typeof NavModal>>();

const count = ref(5);
const defaultSource = ref('');
// Sparse map: only days that have been explicitly overridden
const dayOverrides = ref<Record<number, string>>({});
const saving = ref(false);

// For the "add override" row
const newOverrideDay = ref<number | null>(null);
const newOverrideSource = ref('');

const configuredDays = computed(() =>
	Object.keys(dayOverrides.value).map(Number).sort((a, b) => a - b)
);

const availableDayOptions = computed(() =>
	DAY_NAMES
		.map((label, value) => ({ label, value }))
		.filter(({ value }) => !(value in dayOverrides.value))
);

function addOverride() {
	if (newOverrideDay.value === null || !newOverrideSource.value.trim()) return;
	dayOverrides.value = { ...dayOverrides.value, [newOverrideDay.value]: newOverrideSource.value.trim() };
	newOverrideDay.value = null;
	newOverrideSource.value = '';
}

function removeOverride(day: number) {
	const updated = { ...dayOverrides.value };
	delete updated[day];
	dayOverrides.value = updated;
}

async function loadConfig() {
	try {
		const { data } = await useApiStore().api.get('/now-playing/config');
		count.value = data.count ?? 5;
		defaultSource.value = data.defaultSource ?? '';
		const overrides: Record<number, string> = {};
		if (data.dayOverrides) {
			for (const day of Object.keys(data.dayOverrides)) {
				const val = data.dayOverrides[day];
				if (val) overrides[parseInt(day)] = val;
			}
		}
		dayOverrides.value = overrides;
		newOverrideDay.value = null;
		newOverrideSource.value = '';
	} catch (e) {
		console.error('Failed to load Now Playing config', e);
		toast.add({ severity: 'error', summary: 'Failed to load config', life: 3000 });
	}
}

async function saveConfig() {
	saving.value = true;
	try {
		await useApiStore().api.put('/now-playing/config', {
			count: count.value,
			defaultSource: defaultSource.value || null,
			dayOverrides: dayOverrides.value,
		});
		toast.add({ severity: 'success', summary: 'Now Playing settings saved', life: 3000 });
		await modal.value?.close();
	} catch (e) {
		console.error('Failed to save Now Playing config', e);
		toast.add({ severity: 'error', summary: 'Failed to save config', life: 3000 });
	} finally {
		saving.value = false;
	}
}

defineExpose({
	open: async () => {
		await loadConfig();
		modal.value?.open();
	},
});
</script>

<template>
	<NavModal ref="modal" :width="'28rem'">
		<template #header>
			<h3 style="margin: 0;">Now Playing Settings</h3>
		</template>

		<div class="now-playing-settings">
			<div class="field-row">
				<label>Titles to show</label>
				<InputNumber transparent v-model="count" :min="1" :max="100" :showButtons="true" />
			</div>

			<div class="field-row">
				<label>Default source</label>
				<InputText
					transparent
					v-model="defaultSource"
					placeholder="e.g. Movies"
					class="w-full"
				/>
			</div>

			<div class="day-overrides">
				<div class="day-overrides-header">Day-of-week overrides</div>

				<div
					v-for="day in configuredDays"
					:key="day"
					class="override-row"
				>
					<span class="day-label">{{ DAY_NAMES[day] }}</span>
					<InputText
						transparent
						:modelValue="dayOverrides[day]"
						@update:modelValue="(v) => dayOverrides[day] = v ?? ''"
						:placeholder="defaultSource || 'Use default'"
						class="w-full"
					/>
					<Button
						icon="pi pi-times"
						severity="secondary"
						variant="text"
						@click="removeOverride(day)"
					/>
				</div>

				<div class="override-row add-row" v-if="availableDayOptions.length > 0">
					<Select
						transparent
						v-model="newOverrideDay"
						:options="availableDayOptions"
						optionLabel="label"
						optionValue="value"
						placeholder="Day"
						class="day-select"
					/>
					<InputText
						transparent
						v-model="newOverrideSource"
						placeholder="Source directory"
						class="w-full"
						@keydown.enter="addOverride"
					/>
					<Button
						icon="pi pi-plus"
						severity="secondary"
						variant="text"
						:disabled="newOverrideDay === null || !newOverrideSource.trim()"
						@click="addOverride"
					/>
				</div>
			</div>

			<div class="actions">
				<Button
					label="Save"
					:loading="saving"
					@click="saveConfig"
				/>
			</div>
		</div>
	</NavModal>
</template>

<style scoped lang="scss">
.now-playing-settings {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.field-row {
	display: grid;
	grid-template-columns: 8rem 1fr;
	align-items: center;
	gap: 0.75rem;
}

.day-overrides {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;

	.day-overrides-header {
		font-weight: 600;
		font-size: 0.85rem;
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
}

.override-row {
	display: grid;
	grid-template-columns: 7rem 1fr auto;
	align-items: center;
	gap: 0.5rem;

	.day-label {
		font-size: 0.9rem;
	}

	&.add-row .day-select {
		width: 7rem;
		min-width: 0;
	}
}

.actions {
	display: flex;
	justify-content: flex-end;
}
</style>

