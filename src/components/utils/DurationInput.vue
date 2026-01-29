<script setup lang="ts">
import { MetadataService } from '@/services/metadataService';
import { msToTimeParts, timePartsToMs } from '@/utils/miscUtils';
import InputGroup from 'primevue/inputgroup';
import { ref, watch } from 'vue';

const { max, min = 0, units = ['h', 'm', 's', 'ms'], steppers = true } = defineProps<{
	max?: number,
	min?: number,
	units?: Array<'h'|'m'|'s'|'ms'>,
	steppers?: boolean,
}>();

const emit = defineEmits<{
	change: [value: number],
}>()

const msValue = defineModel<number>();
const parts = ref(msToTimeParts(msValue.value || 0));
watch(() => msValue.value, () => {
	parts.value = msToTimeParts(msValue.value || 0);
});
watch(() => [msValue.value, parts.value, min, max], () => {
	msValue.value = Math.max(min, Math.min(max || Infinity, timePartsToMs(parts.value)));
	emit('change', msValue.value);
}, { deep: true });

</script>

<template>
	<div class="duration-input flex align-items-center gap-1">
		<div v-if="steppers" class="flex justify-content-center flex-grow-1">
			<Button text severity="secondary" icon="pi pi-step-backward" @click="() => msValue! -= 500" />
		</div>
		<template v-if="units.includes('h')">
			<InputNumber v-model="parts.h" showButtons buttonLayout="vertical" size="small" :max="4" :min="0" />
		</template>
		<template v-if="units.includes('h') && units.includes('m')">
			:
		</template>
		<template v-if="units.includes('m')">
			<InputNumber v-model="parts.m" showButtons buttonLayout="vertical" size="small" :max="59" :min="0" />
		</template>
		<template v-if="units.includes('m') && units.includes('s')">
			:
		</template>
		<template v-if="units.includes('s')">
			<InputNumber v-model="parts.s" showButtons buttonLayout="vertical" size="small" :max="59" :min="0" />
		</template>
		<template v-if="units.includes('s') && units.includes('ms')">
			.
		</template>
		<template v-if="units.includes('ms')">
			<InputNumber v-model="parts.ms" showButtons buttonLayout="vertical" size="small" :max="999" :min="0" :step="10" />
		</template>
		<div v-if="steppers" class="flex justify-content-center flex-grow-1">
			<Button text severity="secondary" icon="pi pi-step-forward" @click="() => msValue! += 500" />
		</div>
	</div>
</template>

<style lang="css" scoped>
.duration-input {
	.p-inputnumber {
		width: 2.5em;
	}
	.p-inputnumber:last-of-type {
		width: 3em;
	}
}
</style>