import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router';

export const useMediaStore = defineStore('Media', () => {
	const router = useRouter();
	const currentPath = ref(router.currentRoute?.value?.query.path || new URLSearchParams(location.search).get('path'));
	const updated = ref(0);

	function playMedia(relativePath: string, props: { startTime?: number, restart?: boolean } = {}) {
		if (!relativePath) {
			return;
		}

		currentPath.value = relativePath;
		const isPlayRoute = router.currentRoute.value?.name === 'play';

		const startTime = props.restart ? '0' : String(props.startTime || '');

		const playParams = {
			path: relativePath,
			startTime,
		}

		if (isPlayRoute) {
			history.replaceState(
				{},
				'',
				router.currentRoute.value.path + '?' + new URLSearchParams({ ...(router.currentRoute.value.query || {}), ...playParams }).toString(),
			);
		}
		else {
			router.push({
				name: 'play',
				query: playParams,
			})
		}

		updated.value++;
	}

	return {
		updated,
		currentPath,
		playMedia,
	}
})
