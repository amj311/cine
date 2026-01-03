<script lang="ts" setup>
import { defineComponent, ref, watch, onMounted, onUnmounted, computed, onBeforeMount, onBeforeUnmount } from 'vue';
import Dialog from 'primevue/dialog';
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { defineStore } from 'pinia';
import NavTrigger from './NavTrigger/NavTrigger.vue';

// Define the component using Options API
const navTriggerRef = ref<InstanceType<typeof NavTrigger> | null>(null);

const { closeable = true } = defineProps<{
	title?: string;
	width?: string;
	closeable?: boolean,
}>();

defineExpose({
	open: () => {
		navTriggerRef.value?.open();
	},
	close: () => {
		navTriggerRef.value?.close();
	},
})

</script>

<template>
	<NavTrigger ref="navTriggerRef" triggerKey="nav-modal">
		<template #default="{ show }">
			<template v-if="show">
				<!-- Dialog for desktop view -->
				<Dialog
					:visible="show"
					:header="title"
					:modal="true"
					:style="{ width: width || '30rem' }"
					:closable="closeable"
				>
					<slot></slot>
					<template #closebutton>
						<Button text severity="secondary" class="border-circle" icon="pi pi-times" v-if="closeable" @click="() => navTriggerRef?.close()"></Button>
					</template>
					<template v-for="(slotFn, name) in $slots" #[name]="slotProps">
						<slot :name="name" v-bind="slotProps" />
					</template>
				</Dialog>
			</template>
		</template>
	</NavTrigger>
</template>

<style scoped lang="scss">
</style>
