import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useScreenStore } from './screen.store';

const defaultSettings = {
	is_tv: false,
	// tv_nav: false,
}

export const useSettingsStore = defineStore('Settings', () => {
	const localSettings = ref<typeof defaultSettings>(JSON.parse(localStorage.getItem('_op_localSettings') || JSON.stringify(defaultSettings)));
	watch(() => localSettings.value, () => localStorage.setItem('_op_localSettings', JSON.stringify(localSettings.value)), { deep: true, immediate: true });

	watch(() => ({
		is_tv: localSettings.value.is_tv,
		// tv_nav: localSettings.value.tv_nav,
	}), () => {
		useScreenStore().setAsTv(localSettings.value.is_tv);
		// useScreenStore().setTvNavigation(localSettings.value.is_tv && localSettings.value.tv_nav);
	});

	return {
		localSettings,
	}
})
