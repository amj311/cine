<script
	setup
	lang="ts"
>
import { RouterView, useRoute } from 'vue-router'
import { useTvNavigationStore } from './stores/tvNavigation.store';
import AppBackground from './components/AppBackground.vue';
import { computed, onMounted, ref } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { usePageTitleStore } from './stores/pageTitle.store';
import { useFullscreenStore } from './stores/fullscreenStore.store';
import { useQueryPathStore } from './stores/queryPath.store';

usePageTitleStore();
const tvNavigationStore = useTvNavigationStore();
const showDebug = ref(false);

const confirm = useConfirm();

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
	confirm.require({
		message: 'This looks like a TV environment. Would you lke to go fullscreen?',
		accept: () => {
			useFullscreenStore().userFullscreenRequest();
		},
	});
}

onMounted(() => {
	tvNavigationStore.determineTvEnvironment(suggestTvMode);
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

	<div class="dark-app" :class="{ 'tv-nav': tvNavigationStore.enabled }" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<div class="nav-wrapper" v-if="showNavbar">
			<NavBar />
		</div>
		<RouterView v-slot="{ Component }">
			<KeepAlive :include="['BrowseView']">
				<component :is="Component" />
			</KeepAlive>
		</RouterView>
	</div>

	<div v-if="showDebug" class="debug-info">
		Last mouse move: {{ tvNavigationStore.lastMouseMove }}<br />
		Last mouse position: {{ tvNavigationStore.lastMousePosition }}<br />
		Last mouse move time: {{ tvNavigationStore.lastMouseMoveTime }}<br />
		Last direction: {{ tvNavigationStore.lastDetectedDirection }}<br />
	</div>

	<ConfirmDialog
		class="tvNavigationFocusArea"
	/>
</template>

<style>
#longLoading {
	position: fixed;
	top: 50%;
	left: 50%;
	translate: -50% -50%;
	background-color: #fff;
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
}

</style>
