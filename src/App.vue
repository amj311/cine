<script
	setup
	lang="ts"
>
import { RouterView } from 'vue-router'
import { useTvNavigationStore } from './stores/tvNavigation.store';
import AppBackground from './components/AppBackground.vue';

const tvNavigationStore = useTvNavigationStore();



import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';

let wakeLock: WakeLockSentinel | null = null;
const route = useRoute();

const handleWakeLock = async () => {
	if (route.name === 'play') {
		document.documentElement.requestFullscreen();
		// screen wake lock
		if ('wakeLock' in navigator) {
			wakeLock = await navigator.wakeLock.request('screen');
		}
	} else {
		document.exitFullscreen();
		// release wake lock
		if (wakeLock) {
			await wakeLock.release();
			wakeLock = null;
		}
	}
};

watch(() => route.name, handleWakeLock, { immediate: true });
onBeforeUnmount(handleWakeLock);


</script>

<template>
	<AppBackground />

	<div :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<RouterView v-slot="{ Component }">
			<KeepAlive>
				<component :is="Component" />
			</KeepAlive>
		</RouterView>
	</div>

	<!-- <div v-if="tvNavigationStore.lastKeydownEvent">
		Last keydown event: {{ tvNavigationStore.lastKeydownEvent }}
	</div>
	<div v-if="tvNavigationStore.lastMouseMoveEvent">
		Last mouse event: {{ tvNavigationStore.lastMouseMoveEvent }}
	</div> -->
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
</style>
