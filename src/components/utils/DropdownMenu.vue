<script setup lang="ts">
import { focusAreaClass } from '@/stores/tvNavigation.store';
import TieredMenu from 'primevue/tieredmenu';
import { computed, ref } from 'vue';

const menu = ref<InstanceType<typeof TieredMenu>>();
const props = defineProps<{
	items?: any,
	disabled?: boolean
	style?: any
	size?: 'small' | 'large'
}>();

function openMenu(event) {
	setMenuItems();
	if (!props.disabled) menu.value?.toggle(event);
}

const menuItems = ref<any[]>([]);
function setMenuItems() {
	let items;
	if (Array.isArray(props.items)) {
		items = props.items;
	}
	if (typeof props.items === 'function') {
		items = props.items();
	}
	menuItems.value = items?.length ? items : [{
		label: 'No actions',
		disabled: true,
	}]
}

</script>

<template>
	<span @click="openMenu" class="trigger" v-bind="{ ...$props, ...$attrs }" tabindex="0">
		<slot><Button :size="size" variant="text" severity="contrast" :icon="'pi pi-ellipsis-v'" /></slot>
	</span>
	<TieredMenu ref="menu" id="overlay_menu" :class="focusAreaClass" :popup="true" :model="menuItems" v-bind="$attrs">
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
