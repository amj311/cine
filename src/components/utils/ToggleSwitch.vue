<script setup lang="ts">
import { useAttrs } from 'vue';
import ToggleSwitch from 'primevue/toggleswitch';

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<{
	modelValue?: boolean;
	defaultValue?: boolean;
}>();
const attrs = useAttrs();

</script>

<template>
	<div tabindex="0" role="button" >
		<ToggleSwitch
			v-bind="{ ...props, ...attrs }"
		/>
	</div>
</template>
