<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import NavModal from './utils/NavModal.vue';
import ToggleSwitch from '@/components/utils/ToggleSwitch.vue';
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '@/stores/user.store';
import NowPlayingSettingsModal from './NowPlayingSettingsModal.vue';

const toast = useToast();
const props = defineProps<{
}>();

const modal = ref<InstanceType<typeof NavModal>>();
const localSettings = computed(() => useSettingsStore().localSettings);
const nowPlayingSettingsModal = ref<InstanceType<typeof NowPlayingSettingsModal>>();

defineExpose({
	open: () => modal.value?.open(),
})

async function clearLibraryCache() {
	try {
		await useApiStore().api.post('/emptyCaches');
		toast.add({
			severity: 'success',
			summary: 'Cleared directory cache',
			life: 3000,
		})
	}
	catch (e) {
		toast.add({
			severity: 'error',
			summary: 'Failed to clear directory cache',
			life: 3000,
		})
	}
}

</script>

<template>
	<NavModal
		ref="modal"
		:width="'20rem'"
	>
		<template #header>
			<div class="flex align-items-center gap-3 w-full">
				<h3>Settings</h3>
			</div>
		</template>

		<div
			style="display: grid; grid-template-columns: auto 1fr; gap: 1em; align-items: center;"
		>
			<label>This is a TV</label>
			<div>
				<ToggleSwitch v-model="localSettings.is_tv" />
			</div>

			<div class="grid-row" :disabled="!localSettings.is_tv">
				<label>Use experimental navigation</label>
				<div>
					<ToggleSwitch v-model="localSettings.tv_nav" />
				</div>
			</div>

			<label>Use experimental streaming</label>
			<div>
				<ToggleSwitch v-model="localSettings.use_mse_streaming" />
			</div>

			<label>Show debug</label>
			<div>
				<ToggleSwitch v-model="localSettings.show_debug" />
			</div>

			<div class="flex align-items-center gap-1">
				<label>Now Playing mode</label>
				<Button
					v-if="useUserStore().currentUser.isOwner"
					icon="pi pi-cog"
					variant="text"
					severity="secondary"
					size="small"
					@click="nowPlayingSettingsModal?.open()"
				/>
			</div>
			<div>
				<ToggleSwitch v-model="localSettings.now_playing_mode" />
			</div>

			<template v-if="useUserStore().currentUser.isOwner">
				<Button label="Reset directory cache" severity="warn" @click="clearLibraryCache" />
				<div></div>
			</template>
		</div>
	</NavModal>
	<NowPlayingSettingsModal ref="nowPlayingSettingsModal" />
</template>

<style
	lang="scss"
	scoped
>
.grid-row {
	display: contents;

	&[disabled="true"] * {
		pointer-events: none;
		opacity: .5;
	}
}
</style>
