<script setup lang="ts">
import { focusAreaClass, useScreenStore } from '@/stores/screen.store';
import TieredMenu from 'primevue/tieredmenu';
import { nextTick, ref } from 'vue';
import DropdownTrigger from './DropdownTrigger.vue';

const trigger = ref<InstanceType<typeof DropdownTrigger>>();
const props = defineProps<{
	items?: any,
	disabled?: boolean
	style?: any
	size?: 'small' | 'large'
}>();

const menuItems = ref<any[]>([]);

function setMenuItems() {
	let items;
	if (Array.isArray(props.items)) {
		items = props.items;
	}
	if (typeof props.items === 'function') {
		items = props.items();
	}
	const useItems = (items?.length ? [...items] : [
		{
			label: 'No actions',
			disabled: true,
		},
	]);
	// overwrite item commands to close menu and THEN do action
	// Leave some time for nav to update
	menuItems.value = useItems.map(i => ({
		...i,
		command: async () => {
			await trigger.value?.close();
			i.command.call(null);
		}
	}))
}

</script>

<template>
	<DropdownTrigger ref="trigger">
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
