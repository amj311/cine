<script
	setup
	lang="ts"
>
import { RouterView } from 'vue-router'
import { useTvNavigationStore } from './stores/tvNavigation.store';
import AppBackground from './components/AppBackground.vue';
import { onMounted, ref } from 'vue';

const tvNavigationStore = useTvNavigationStore();
const showDebug = ref(false);

onMounted(() => {
	// tvNavigationStore.determineTvEnvironment();
	tvNavigationStore.engageTvMode();
});
</script>

<template>
	<AppBackground />

	<div class="dark-app" :class="{ 'tv-nav': tvNavigationStore.enabled }" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
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

	<div id="tvClickCapture" v-if="tvNavigationStore.enabled" style="position: fixed; top: 0; bottom: 0; left: 0; right: 0;"></div>
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
	outline: 1px solid var(--color-contrast) !important;
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

#tvClickCapture {
	pointer-events: all;
	cursor: none !important;
}
</style>
