<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Drawer from 'primevue/drawer';
import NavTrigger from './NavTrigger.vue';
import Button from 'primevue/button';

const props = defineProps<{
	triggerKey: string;
	onClose?: () => void;
	title?: string;
	width?: number;
}>();

const drawerTrigger = ref<InstanceType<typeof NavTrigger> | null>(null);
const title = props.title || ' ';

const smallWidth = computed(() => props.width || 30);

defineExpose({
	trigger: () => drawerTrigger.value,
});
</script>

<template>
	<NavTrigger
		ref="drawerTrigger"
		:triggerKey="triggerKey"
		:onClose="props.onClose"
	>
		<template #default="{ show }">
			<Drawer :visible="show" position="right" :header="title" :class="`w-full sm:w-${smallWidth}rem`">
				<template #closebutton>
					<Button icon="pi pi-times" size="small" text @click="drawerTrigger?.close" severity="secondary" />
				</template>

				<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
					<slot :name="name" v-bind="slotProps" />
				</template>
			</Drawer>
		</template>
	</NavTrigger>
</template>

<style scoped lang="scss">
</style>
