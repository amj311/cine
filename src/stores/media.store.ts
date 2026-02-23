import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router';

export const useMediaStore = defineStore('Media', () => {
	const router = useRouter();
	const currentPath = ref(router.currentRoute?.value?.query.path || new URLSearchParams(location.search).get('path'));

	function playMedia(relativePath: string, props: { start?: number } = {}) {
		if (!relativePath) {
			return;
		}

		currentPath.value = relativePath;
		const isPlayRoute = router.currentRoute.value?.name === 'play';

		if (isPlayRoute) {
			history.replaceState(
				{},
				'',
				router.currentRoute.value.path + '?' + new URLSearchParams({ ...(router.currentRoute.value.query || {}), path: relativePath }).toString(),
			);
		}
		else {
			router.push({
				name: 'play',
				query: {
					path: relativePath,
					startTime: props.start ?? undefined,
				}
			})
		}
	}

	return {
		currentPath,
		playMedia,
	}
})
