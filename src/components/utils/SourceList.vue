<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import DirectoryPicker from './DirectoryPicker.vue';
import type { NowPlayingSource, NowPlayingTitleFilter } from '@/stores/profile.store';

const sources = defineModel<NowPlayingSource[]>({ required: true });

const filterOptions: { label: string; value: NowPlayingTitleFilter }[] = [
	{ label: 'Movies only', value: 'movie' },
	{ label: 'Series only', value: 'series' },
];

function addSource() {
	sources.value.push({ directory: '', count: 1, filter: null });
}
function removeSource(i: number) {
	sources.value.splice(i, 1);
}
</script>

<template>
	<div class="source-list">
		<div v-for="(src, i) in sources" :key="i" class="source-block my-1">
			<DirectoryPicker v-model="src.directory" />
			<div class="source-controls">
				<div>Qty:</div>
				<InputNumber transparent v-model="src.count" :min="1" :max="100" :showButtons="false" class="source-count" />
				<div>Type:</div>
				<Select transparent v-model="src.filter" :options="filterOptions" optionLabel="label" optionValue="value" placeholder="All titles" :showClear="!!src.filter" class="source-filter" />
				<div class="flex-grow-1" />
				<Button icon="pi pi-times" severity="secondary" variant="text" :disabled="sources.length === 1" @click="removeSource(i)" />
			</div>
		</div>
		<Button icon="pi pi-plus" label="Add source" variant="text" severity="secondary" size="small" @click="addSource" />
	</div>
</template>

<style scoped lang="scss">
.source-list {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.source-block {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}

.source-controls {
	display: flex;
	align-items: center;
	gap: 0.4rem;
}
</style>
