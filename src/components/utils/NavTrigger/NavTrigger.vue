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

	function open(viewKey: string) {
		try {
			viewStack.value.push(viewKey);
			router.push({
				query: { ...router.currentRoute.value.query, v: viewKey },
			});
			document.body.classList.add('prevent-scroll');
		} catch (error) {
			console.error('Error opening NavTrigger:', error);
		}
	}
	function close(cb?: () => void) {
		router.back();
		cb?.();
	}

	watch(
		vQuery,
		(newValue, oldValue) => {
			const indexOfNew = viewStack.value.indexOf(newValue);
			// If the new value doesn't exist, the entire stack is cleared
			viewStack.value = viewStack.value.slice(0, indexOfNew + 1);

			// if stack is empty, we remove the query parameter
			if (viewStack.value.length === 0) {
				history.replaceState(
					{},
					document.title,
					router.currentRoute.value.path + '?' + new URLSearchParams(router.currentRoute.value?.query as Record<string, string>).toString()
				);
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
			open: () => store.open(trueKey.value),
			close: () => store.close(props.onClose),
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
