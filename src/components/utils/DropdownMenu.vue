<script setup lang="ts">
import { focusAreaClass, useScreenStore } from '@/stores/screen.store';
import TieredMenu from 'primevue/tieredmenu';
import { ref } from 'vue';
import DropdownTrigger from './DropdownTrigger.vue';

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
	menuItems.value = items?.length ? [...items] : [
		{
			label: 'No actions',
			disabled: true,
		},
	];

	if (useScreenStore().tvNavEnabled) {
		menuItems.value.push({
			label: 'Cancel',
			command: () => {},
		})
	}
}

</script>

<template>
	<DropdownTrigger>
		<span @click="setMenuItems"><slot><Button :size="size" variant="text" severity="contrast" :icon="'pi pi-ellipsis-v'" /></slot></span>

		<template #content>
			<TieredMenu id="overlay_menu" :class="focusAreaClass" :model="menuItems.filter(Boolean)" v-bind="$attrs">
				<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
					<slot :name="name" v-bind="slotProps" />
				</template>
			</TieredMenu>
		</template>
	</DropdownTrigger>
</template>

<style scoped lang="scss">
.trigger {
	display: inline-block;
}
</style>
