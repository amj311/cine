import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router';

export const useQueryPathStore = defineStore('QueryPath', () => {
	const router = useRouter();
	const currentDir = ref<string[]>([]);
	const currentPath = computed(() => currentDir.value.join('/'));

	const parentFile = computed(() => {
		if (currentDir.value.length === 0) {
			return null;
		}
		return currentDir.value[currentDir.value.length - 2];
	});
	const currentFile = computed(() => {
		if (currentDir.value.length === 0) {
			return null;
		}
		return currentDir.value[currentDir.value.length - 1];
	});


	function updatePathFromQuery() {
		const queryPath = router.currentRoute.value?.query.path as string;
		currentDir.value = queryPath ? queryPath.split('/') : [];
	}

	// Fetch the root directory on component mount
	updatePathFromQuery();
	watch(() => router.currentRoute.value?.query.path, updatePathFromQuery)


	function updateQuery() {
		router.push({
			query: {
				path: currentDir.value.join('/'),
			}
		})
	}

	return {
		currentDir,
		currentPath,
		parentFile,
		currentFile,

		updatePathFromQuery,

		goToRoot() {
			// Reset the current directory to the root
			currentDir.value = [];
			updateQuery();
		},

		goUp() {
			// Remove the last folder from the current directory
			if (currentDir.value.length > 0) {
				currentDir.value.pop();
			}
			updateQuery();
		},

		goToAncestor(dir: string) {
			// Find the index of the ancestor directory
			const index = currentDir.value.indexOf(dir);
			if (index !== -1) {
				// Remove all directories after the ancestor
				currentDir.value = currentDir.value.slice(0, index + 1);
			}
			updateQuery();
		},

		enterDirectory(dir: string) {
			// Add the new folder to the current directory
			currentDir.value.push(dir);
			updateQuery();
		},

	}
})
