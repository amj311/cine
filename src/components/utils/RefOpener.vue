<script setup lang="ts">
import Menu from 'primevue/menu';
import { ref } from 'vue';

const menu = ref<InstanceType<typeof Menu>>();
const props = defineProps<{
	disabled?: boolean
	closeOnClick?: boolean
	triggerAttrs?: any
	component: any,
	refAttrs?: any
}>();

function openMenu(event) {
	if (!props.disabled) menu.value?.toggle(event);
}

</script>

<template>
	<span @click="openMenu" v-bind="triggerAttrs">
		<slot name="trigger"></slot>
	</span>
	<component ref="menu" :is="component" v-bind="refAttrs" @click="closeOnClick ? menu?.hide() : null">
		<slot name="ref"></slot>
	</component>
</template>

<style scoped>
</style>
