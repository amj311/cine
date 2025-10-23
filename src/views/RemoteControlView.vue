<script
	setup
	lang="ts"
>
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
import { useApiStore, type Host } from '../stores/api.store';
import DropdownMenu from '@/components/utils/DropdownMenu.vue';
import MediaTimer from '@/components/MediaTimer.vue';

const apiStore = useApiStore();
const toast = useToast();

</script>

<template>
	<div class="flex flex-column align-items-center justify-content-center gap-5">
		<div class="flex flex-column gap-2" style="width: 100%; max-width: 25rem;">
			<MediaTimer />
		</div>
	</div>
</template>

<style>
</style>
