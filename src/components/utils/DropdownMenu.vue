<script setup lang="ts">
import { focusAreaClass } from '@/stores/tvNavigation.store';
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
	<span @click="openMenu" class="trigger" v-bind="{ ...$props, ...$attrs }" tabindex="0"><slot></slot></span>
	<TieredMenu ref="menu" id="overlay_menu" :class="focusAreaClass" :popup="true" v-bind="$attrs">
		<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
			<slot :name="name" v-bind="slotProps" />
		</template>
	</TieredMenu>
</template>

<style scoped lang="scss">
.trigger {
	display: inline-block;
}
</style>
