<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { defineProps, ref, computed, onBeforeMount } from 'vue';

const props = defineProps<{
	paths: string[];
}>();

const metadata = ref<any[]>([]);
const posters = computed(() => metadata.value.map((item) => item.poster_thumb).filter(Boolean).slice(0, 4));
const previewSlots = computed(() => {
	if (posters.value.length === 1) {
		const width = '100%';
		return [
			{ top: '0', left: '0', width },
		];
	}
	if (posters.value.length === 2) {
		const width = '75%';
		return [
			{ top: '0', left: '0', width },
			{ bottom: '0', right: '0', width },
		];
	}
	if (posters.value.length === 3) {
		const width = '75%';
		return [
			{ top: '0', left: '0', width },
			{ top: '12%', right: '0', width },
			{ bottom: '0', left: '12%', width },
		];
	}
	if (posters.value.length === 4) {
		const width = '75%';
		return [
			{ top: '0', left: '0', width },
			{ top: '8%', right: '4%', width },
			{ bottom: '8%', left: '4%', width },
			{ bottom: '0', right: '0', width },
		];
	}
	return [];
});

async function loadMetadata() {
	metadata.value = (await Promise.all(
		props.paths.map(async (path) => {
			return await MetadataService.getMetadata({ relativePath: path });
		})
	)).filter(Boolean);
}

onBeforeMount(() => {
	loadMetadata().catch((error) => {
		console.error('Error loading metadata:', error);
	});
});

</script>

<template>
	<div class="collection-poster">
		<img
			v-for="url, i in posters"
			:src="url"
			:style="{
				position: 'absolute',
				borderRadius: '5px',
				zIndex: i,
				boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
				...previewSlots[i],
			}"
		/>
	</div>
</template>

<style scoped>
.collection-poster {
	position: absolute;
	--inset: 10%;
	top: var(--inset);
	left: var(--inset);
	bottom: var(--inset);
	right: var(--inset);
}
</style>
