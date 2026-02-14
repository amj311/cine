<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue';
import ToggleSwitch from 'primevue/toggleswitch';

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<{
	modelValue?: boolean;
	defaultValue?: boolean;
}>();
const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'change', value: boolean): void;
}>();
const attrs = useAttrs();

const localValue = ref<boolean>(props.modelValue ?? props.defaultValue ?? false);
watch(
	() => props.modelValue,
	(value) => {
		if (typeof value === 'boolean') {
			localValue.value = value;
		}
	}
);

const toggleProps = computed(() => {
	const { modelValue, defaultValue, ...rest } = props as any;
	return rest;
});

function onWrapperClick() {
	const nextValue = !localValue.value;
	localValue.value = nextValue;
	emit('update:modelValue', nextValue);
	emit('change', nextValue);
}
</script>

<template>
	<div tabindex="0" role="button" @click="onWrapperClick">
		<ToggleSwitch
			v-bind="{ ...toggleProps, ...attrs }"
			:modelValue="localValue"
		/>
	</div>
</template>
