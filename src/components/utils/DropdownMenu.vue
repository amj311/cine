<script setup lang="ts">
import TieredMenu from 'primevue/tieredmenu';
import { ref } from 'vue';

const menu = ref<InstanceType<typeof TieredMenu>>();
const props = defineProps<{
	disabled?: boolean
	style?: any
}>();

function openMenu(event) {
	if (!props.disabled) menu.value?.toggle(event);
}

</script>

<template>
	<span @click="openMenu" v-bind="{ ...$props, ...$attrs }"><slot></slot></span>
	<TieredMenu ref="menu" id="overlay_menu" :popup="true" v-bind="$attrs">
		<template #start><slot name="start"></slot></template>
	</TieredMenu>
</template>

<style scoped>
</style>
