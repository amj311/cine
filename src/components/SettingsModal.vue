<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import type Dialog from 'primevue/dialog';
import { useSettingsStore } from '@/stores/settings.store';

const props = defineProps<{
}>();

const visible = ref(false);
const localSettings = computed(() => useSettingsStore().localSettings);

defineExpose({
	open: () => visible.value = true,
})

</script>

<template>
	<Dialog
		:visible="visible"
		:closable="false"
		class="w-20rem"
	>
		<template #header>
			<div class="flex align-items-center gap-3 w-full">
				<h3>Settings</h3>
				<div class="flex-grow-1" />
				<Button text severity="secondary" icon="pi pi-times" @click="visible = false" />
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
		</div>
	</Dialog>
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
