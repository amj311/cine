<script
	setup
	lang="ts"
>
import { RouterView, useRoute } from 'vue-router'
import { useTvNavigationStore } from './stores/tvNavigation.store';
import AppBackground from './components/AppBackground.vue';
import { computed, onMounted, ref } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { usePageTitleStore } from './stores/pageTitle.store';
import { useFullscreenStore } from './stores/fullscreenStore.store';
import { useApiStore } from './stores/api.store';

const apiStore = useApiStore();

usePageTitleStore();
const tvNavigationStore = useTvNavigationStore();
const showDebug = ref(false);

const confirm = useConfirm();
const toast = useToast();

async function handleExitFullscreen() {
	return new Promise<boolean>((resolve) => {
		confirm.require({
			message: 'Oops - would you lke to go fullscreen again?',
			accept: () => resolve(true),
			reject: () => resolve(false),
		});
	});
}

function suggestTvMode() {
	return new Promise<boolean>((resolve) => {
		confirm.require({
			message: 'This looks like a TV environment. Do you want to enable TV navigation?',
			accept: () => resolve(true),
			reject: () => resolve(false),
		});
	});
}

async function suggestFullscreen() {
	toast.add({
		severity: 'info',
		summary: 'TV detected',
		detail: 'TV Navigation has been enabled. You can use the arrow keys to navigate.',
		life: 5000,
	});
	// confirm.require({
	// 	message: 'This looks like a TV environment. Would you lke to go fullscreen?',
	// 	accept: () => {
	// 		useFullscreenStore().userFullscreenRequest();
	// 	},
	// });
}

onMounted(() => {
	tvNavigationStore.determineTvEnvironment();
	tvNavigationStore.onTvDetected(suggestFullscreen);
	useFullscreenStore().setAccidentalExitHandler(handleExitFullscreen);
});

const route = useRoute();
const showNavbar = computed(() => {
	return !route?.path.startsWith('/play')
})
</script>

<template>
	<AppBackground />
	<div class="dark-app app-wrapper" :class="{ 'tv-nav': tvNavigationStore.enabled }" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<div v-if="apiStore.isInitializing">
			<div id="longLoading">
				<i class="pi pi-spin pi-spinner spin" />
				Loading...
			</div>
		</div>

		<div v-else-if="!apiStore.selectedHost">
			<h1>Failed to connect to any servers!</h1>
		</div>

		<div v-else>
			<div class="nav-wrapper" v-if="showNavbar">
				<NavBar />
			</div>
			<div class="body-wrapper">
				<RouterView v-slot="{ Component }">
					<KeepAlive :include="['BrowseView']">
						<component :is="Component" />
					</KeepAlive>
				</RouterView>
			</div>
		</div>
	</div>

	<div v-if="showDebug" class="debug-info">
		Last mouse move: {{ tvNavigationStore.lastMouseMove }}<br />
		Last mouse position: {{ tvNavigationStore.lastMousePosition }}<br />
		Last mouse move time: {{ tvNavigationStore.lastMouseMoveTime }}<br />
		Last direction: {{ tvNavigationStore.lastDetectedDirection }}<br />
		Focused: {{ tvNavigationStore.lastFocusedEl?.innerText || 'none' }}<br />
	</div>

	<ConfirmDialog
		class="tvNavigationFocusArea"
	/>
	<Toast />
</template>

<style>

.app-wrapper {
	display: flex;
	flex-direction: column;
	height: 100%;

	.body-wrapper {
		flex-grow: 1;
		min-height: 0;
	}
}


#longLoading {
	position: fixed;
	top: 50%;
	left: 50%;
	translate: -50% -50%;
	background-color: var(--color-background-mute);
	box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
	padding: 1em;
	border-radius: 5px;
	z-index: 1000;
	display: flex;
	justify-content: center;
	align-items: center;
	gap: .5em;
}

.spin {
	animation: spin 1500ms linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}

	to {
		transform: rotate(360deg);
	}
}

.tv-nav :focus {
	outline: 2px solid var(--color-contrast) !important;
	outline-offset: 2px !important;
}

.debug-info {
	position: fixed;
	top: 0;
	left: 0;
	color: white;
	padding: 1em;
	z-index: 10000;
	pointer-events: none;
	background-color: rgba(0, 0, 0, 0.5);
}

</style>
