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
import { useApiStore, type Host } from './stores/api.store';
import { useUserStore } from './stores/user.store';
import LoginPage from './views/LoginPage.vue';
import OfflinePage from './views/OfflinePage.vue';
import SharedPage from './views/SharedPage.vue';

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

async function alertTvDetected() {
	toast.add({
		severity: 'info',
		summary: 'TV detected',
		detail: 'TV Navigation has been enabled. You can use the arrow keys to navigate.',
		life: 5000,
	});
}

onMounted(() => {
	tvNavigationStore.determineTvEnvironment();
	tvNavigationStore.onTvDetected(alertTvDetected);
});

const route = useRoute();
const showNavbar = computed(() => {
	return !route?.path.startsWith('/play')
})

</script>

<template>
	<AppBackground />
	<div class="dark-app app-wrapper" :class="{ 'tv-nav': tvNavigationStore.enabled }" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<template v-if="apiStore.isInitializing || !useUserStore().hasLoadedSessionData">
			<div id="longLoading">
				<i class="pi pi-spinner spin" />
				Loading...
			</div>
		</template>

		<template v-else-if="!useUserStore().isLoggedIn">
			<LoginPage />
		</template>

		<template v-else-if="!useUserStore().isOwner">
			<SharedPage />
		</template>

		<template v-else-if="!apiStore.selectedHost">
			<OfflinePage />
		</template>

		<template v-else>
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
		</template>
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
	padding: 1em;
	border-radius: 5px;
	z-index: 1000;
	display: flex;
	justify-content: center;
	align-items: center;
	gap: .5em;
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
