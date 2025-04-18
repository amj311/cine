<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { ref } from 'vue';

/**
 * A simple component wrapper that passes to its slot the metadata or if the metadata is loading
 */
const props = defineProps<{
	media;
	detailed?: boolean;
}>();

const isLoading = ref(false);
const metadata = ref<any>(null);

async function loadMetadata() {
	if (props.media.metadata) {
		metadata.value = props.media.metadata;
	}
	isLoading.value = true;
	try {
		metadata.value = await MetadataService.getMetadata(props.media, props.detailed);
	} catch {
		console.error('Error loading metadata');
	} finally {
		isLoading.value = false;
	}
}

loadMetadata();
</script>

<template>
	<slot :isLoadingMetadata="isLoading" :metadata="metadata"></slot>
</template>
