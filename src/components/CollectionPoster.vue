<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { defineProps, ref, computed, onBeforeMount } from 'vue';

const props = defineProps<{
	paths: string[];
}>();

const metadata = ref<any[]>([]);
const posters = computed(() => metadata.value.map((item) => item.poster_thumb).filter(Boolean));

async function loadMetadata() {
	console.log(props.paths)
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
			width: `85%`,
			borderRadius: '5px',
			top: `${i * 10}px`,
			left: `${i * 10}px`,
			zIndex: 10 - i,
			boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
		}"
	/>
</template>

<style scoped>
</style>
