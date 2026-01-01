<script setup lang="ts">
import { focusAreaClass } from '@/stores/tvNavigation.store';
import TieredMenu from 'primevue/tieredmenu';
import { ref } from 'vue';

const menu = ref<InstanceType<typeof TieredMenu>>();
const props = defineProps<{
	disabled?: boolean
	style?: any
	size?: 'small' | 'large'
}>();

function openMenu(event) {
	if (!props.disabled) menu.value?.toggle(event);
}

</script>

<template>
	<span @click="openMenu" class="dropdown-trigger-trigger" v-bind="{ ...$props, ...$attrs }" tabindex="0">
		<slot><Button :size="size" variant="text" severity="contrast" :icon="'pi pi-ellipsis-v'" /></slot>
	</span>
	<TieredMenu ref="menu" class="dropdown-trigger-wrapper" :class="focusAreaClass" :popup="true">
		<template #end>
			<slot name="content" />
		</template>
	</TieredMenu>
</template>

<style lang="scss">
.dropdown-trigger-trigger {
	display: inline-block;
}

.dropdown-trigger-wrapper .p-tieredmenu-root-list {
	padding: 0 !important;
}
</style>
