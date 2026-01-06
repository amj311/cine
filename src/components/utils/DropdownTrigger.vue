<script setup lang="ts">
import { focusAreaClass, useScreenStore } from '@/stores/screen.store';
import TieredMenu from 'primevue/tieredmenu';
import { nextTick, ref } from 'vue';
import NavTrigger from './NavTrigger/NavTrigger.vue';
import type Popover from 'primevue/popover';

const props = defineProps<{
	disabled?: boolean
	style?: any
	size?: 'small' | 'large'
}>();

const isOpen = ref(false);
const menu = ref<InstanceType<typeof TieredMenu>>();
const navTrigger = ref<InstanceType<typeof NavTrigger> | null>(null);

function openMenu(event) {
	if (!props.disabled && !isOpen.value) {
		navTrigger.value?.open();
		menu.value?.show(event);
		isOpen.value = true;
	}
}

function toggleMenu(event) {
	if (props.disabled) {
		return;
	}
	if (isOpen.value) {
		menu.value?.hide();
	}
	else {
		openMenu(event);
	}
}

async function doMenuHide() {
	if (isOpen.value) {
		await navTrigger.value?.close();
	}
	isOpen.value = false;
}

function doTriggerHide() {
	isOpen.value = false;
	nextTick(() => {
		menu.value?.hide();
	})
}

defineExpose({
	async close() {
		await navTrigger.value?.close();
	}
})


</script>

<template>
	<span @click="toggleMenu" class="dropdown-trigger-trigger" v-bind="{ ...$props, ...$attrs }" tabindex="0">
		<slot><Button :size="size" variant="text" severity="contrast" :icon="'pi pi-ellipsis-v'" /></slot>
	</span>
	<!-- Using TieredMenu just for the popup -->
	<NavTrigger
		ref="navTrigger"
		triggerKey="dropdown-trigger"
		:onClose="doTriggerHide"
	>
		<template #default="{ show }">
			<TieredMenu ref="menu" class="dropdown-trigger-wrapper" :class="focusAreaClass" :popup="true" @hide="doMenuHide">
				<template #start>
					<slot name="content" />
				</template>
			</TieredMenu>
		</template>
	</NavTrigger>
</template>

<style lang="scss">
.dropdown-trigger-trigger {
	display: inline-block;
}

.dropdown-trigger-wrapper .p-tieredmenu-root-list {
	padding: 0 !important;
}
</style>
