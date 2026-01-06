<!-- Opens menus and overlays attached with navigation state such that they can be properly dismissed when navigating away -->

<script lang="ts">
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';


const useStore = defineStore('NavTrigger', () => {
	const router = useRouter();

	const viewStack = ref<string[]>([]);

	// The key of the most recent item.
	const vQuery = computed<string>(() => {
		return router.currentRoute.value.query.v?.toString() || '';
	});

	async function open(viewKey: string) {
		try {
			viewStack.value.push(viewKey);
			router.push({
				query: { ...router.currentRoute.value.query, v: viewKey },
			});
			// router.push('/');
			document.body.classList.add('prevent-scroll');
			// Wait for navs tp update before allowing next action
			await new Promise(res => setTimeout(res, 100));
		} catch (error) {
			console.error('Error opening NavTrigger:', error);
		}
	}
	async function close(viewKey: string, cb?: () => void) {
		// remove the desired key from the viewStack and update the query to the new top-of-stack
		viewStack.value = viewStack.value.filter(v => v !== viewKey);
		router.back();
		// Wait for navs tp update before allowing next action
		await new Promise(res => setTimeout(res, 100));
		cb?.();
	}

	watch(
		vQuery,
		(newValue, oldValue) => {
			const indexOfNew = viewStack.value.indexOf(newValue);
			// If the new value doesn't exist, the entire stack is cleared
			viewStack.value = viewStack.value.slice(0, indexOfNew + 1);

			// if stack is empty, we remove the query parameter
			// small bug causes this to clear the current path on refresh bc router does not have route info yet
			// but we don't intend to keep triggers open across refreshes so that's okay.
			const hasInitRouter = router.currentRoute.value.path === location.pathname;
			if (viewStack.value.length === 0 && hasInitRouter) {
				router.replace({
					query: { ...router.currentRoute.value.query, v: null },
				});
				// also restore scroll
				document.body.classList.remove('prevent-scroll');
			}
		},
		{ immediate: true }
	);

	return {
		viewStack,
		open,
		close,
	};
});


export default {
	name: 'PromptModal',
	emits: ['open', 'close'],
	props: {
		triggerKey: {
			type: String,
			required: true,
		},
		onClose: {
			type: Function,
			required: false,
		},
	},
	setup(props) {
		const store = useStore();
		const trueKey = computed(() => {
			return props.triggerKey + '-' + Math.random().toString(36).substring(2, 8);
		});

		const show = computed(() => {
			return store.viewStack.includes(trueKey.value);
		});

		watch(() => show.value, () => {
			if (!show.value) {
				props.onClose?.call(null);
			}
		})

		return {
			show,
			async open() { await store.open(trueKey.value) },
			async close() { await store.close(trueKey.value, props.onClose) },
		};
	},
};
</script>

<template>
	<slot :show="show"></slot>
</template>

<style>
body.prevent-scroll {
	overflow: hidden;
}
</style>
