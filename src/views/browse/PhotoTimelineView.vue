<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApiStore } from '@/stores/api.store';
import { type GalleryFile } from '@/components/GalleryFileFrame.vue';
import PhotoTimelineGallery from './PhotoTimelineGallery.vue';
import { encodeMediaPath } from '@/utils/miscUtils';

const props = defineProps<{
	relativePath: any;
}>();

const allItems = ref<any[]>([]);
const allFiles = ref<GalleryFile[]>([]);
const api = useApiStore().api;
async function loadItems() {
	try {
		const { data } = await api.get('/flat?path=' + encodeMediaPath(props.relativePath));
		allItems.value = data.data?.items || [];
		allFiles.value = data.data?.files || [];
	}
	catch (error) {
		console.error('Error loading items:', error);
	}
}
watch(() => props.relativePath, loadItems, { immediate: true });

</script>

<template>
	<PhotoTimelineGallery :files="allFiles" />
</template>

<style scoped lang="scss">
</style>
