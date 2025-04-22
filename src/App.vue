<script
	setup
	lang="ts"
>
import { RouterView } from 'vue-router'
import { useTvNavigationStore } from './stores/tvNavigation.store';
import AppBackground from './components/AppBackground.vue';

const tvNavigationStore = useTvNavigationStore();

</script>

<template>
	<AppBackground />

	<div class="dark-app" :style="{ maxHeight: '100%', height: '100%', overflowY: 'hidden' }">
		<RouterView v-slot="{ Component }">
			<KeepAlive :include="['BrowseView']">
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
