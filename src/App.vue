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
import { useApiStore, type Host } from './stores/api.store';
import Logo from './components/Logo.vue';
import DropdownMenu from './components/utils/DropdownMenu.vue';

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
	// confirm.require({
	// 	message: 'This looks like a TV environment. Would you lke to go fullscreen?',
	// 	accept: () => {
	// 		useFullscreenStore().userFullscreenRequest();
	// 	},
	// });
}

onMounted(() => {
	tvNavigationStore.determineTvEnvironment();
	tvNavigationStore.onTvDetected(alertTvDetected);
	// useFullscreenStore().setAccidentalExitHandler(handleExitFullscreen);
});

const route = useRoute();
const showNavbar = computed(() => {
	return !route?.path.startsWith('/play')
})


const attemptingHostConnection = ref<Host | null>(null);
async function attemptHostConnection(host: Host) {
	if (attemptingHostConnection.value) {
		return;
	}
	attemptingHostConnection.value = host;
	try {
		await new Promise((r) => setTimeout(r, 1000));
		const success = await apiStore.connectToHost(host);
		if (success) {
			toast.add({
				severity: 'success',
				summary: 'Connected',
				detail: `Connected to ${host.hostname}`,
				life: 5000,
			});
		} else {
			toast.add({
				severity: 'error',
				summary: 'Failed to connect',
				detail: `Failed to connect to ${host.hostname}`,
				life: 5000,
			});
		}
	} catch (e) {
		toast.add({
			severity: 'error',
			summary: 'Failed to connect',
			detail: `Failed to connect to ${host.hostname}`,
			life: 5000,
		});
	} finally {
		attemptingHostConnection.value = null;
	}
}

function addHost() {
	const name = prompt('Enter the name of the host');
	if (!name) {
		return;
	}
	const url = prompt('Enter the URL of the host');
	if (!url) {
		return;
	}
	const newHost = apiStore.addHost(name, url);
	attemptHostConnection(newHost).catch(console.log);
}

function changeHostUrl(host: Host) {
	const newUrl = prompt('Enter the new URL of the host', host.baseUrl);
	if (!newUrl) {
		return;
	}
	host.baseUrl = newUrl;
	apiStore.updateHost(host.hostname, { baseUrl: newUrl });
}

</script>

<template>
	<AppBackground />
	<div class="dark-app app-wrapper" :class="{ 'tv-nav': tvNavigationStore.enabled }" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<template v-if="apiStore.isInitializing">
			<div id="longLoading">
				<i class="pi pi-spinner spin" />
				Loading...
			</div>
		</template>

		<template v-else-if="!apiStore.selectedHost">
			<div class="flex flex-column align-items-center justify-content-center gap-5">
				<Logo class="mt-5" />
				<h3>Failed to connect to any servers!</h3>
				<div class="flex flex-column gap-2" style="width: 100%; max-width: 25rem;">
					<div
						class="host-card flex gap-3 align-items-center bg-soft p-3 w-full border-round cursor-pointer"
						v-for="host in apiStore.availableHosts"
						:key="host.hostname"
						@click="attemptHostConnection(host)"
					>
						<div class="">
							<div>{{ host.hostname }}</div>
							<div class="text-muted text-small">{{ host.baseUrl }}</div>
						</div>
						<div class="flex-grow-1"></div>
						<div>
							<DropdownMenu
								:model="[
									{
										label: 'Edit',
										icon: 'pi pi-pencil',
										command: () => changeHostUrl(host),
									},
									{
										label: 'Delete',
										icon: 'pi pi-trash',
										command: () => {
											apiStore.removeHost(host.hostname);
										}
									}
								]"
								@click.stop
							>
								<Button
									v-if="host.isCustom"
									icon="pi pi-pencil"
									text
									severity="secondary"
								/>
							</DropdownMenu>
							<Button
								:class="{ 'spin': attemptingHostConnection?.hostname === host.hostname }"
								text
								severity="secondary"
								:icon="'pi pi-sync'"
							/>
							
						</div>
					</div>
				</div>
				<Button
					:label="'Add Host'"
					:icon="'pi pi-plus'"
					text
					@click="addHost"
				/>
			</div>
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
