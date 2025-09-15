<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { defineProps, ref, computed, onBeforeMount } from 'vue';

const props = defineProps<{
	paths: string[];
}>();

const metadata = ref<any[]>([]);
const posters = computed(() => metadata.value.map((item) => item.poster_thumb).filter(Boolean));

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
	<img
		v-for="url, i in posters.slice(0, 3)"
		:src="url"
		:style="{
			position: 'absolute',
			width: `calc(100% - ${25 * Math.min(3, posters.length - 1)}px)`,
			borderRadius: '5px',
			top: `${i * 25}px`,
			left: `${i * 25}px`,
			zIndex: i,
			boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
		}"
	/>
</template>

<style scoped>
</style>
