<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { ref } from 'vue';

/**
 * A simple component wrapper that passes to its slot the metadata or if the metadata is loading
 */
const props = defineProps<{
	detailed?: boolean;
}>();

const media = defineModel<any>('media');

const isLoading = ref(false);
const metadata = ref<any>(null);

async function loadMetadata() {
	if (media.value.metadata) {
		metadata.value = media.value.metadata;
		return
	}
	isLoading.value = true;
	try {
		metadata.value = await MetadataService.getMetadata(media.value, props.detailed);
		if (metadata.value) {
			media.value.metadata = metadata.value;
		}
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
