<script
	setup
	lang="ts"
>
import { msToTimeParts } from '@/utils/miscUtils';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import DigitTicker from './DigitTicker.vue';

const props = defineProps<{
	endMs: number,
}>()

const remaining = ref(computeRemaining());
function computeRemaining() {
	return Math.max(0, props.endMs - Date.now());
}
const pieces = computed(() => msToTimeParts(remaining.value));
let interval;

onMounted(() => {
	interval = setInterval(() => remaining.value = computeRemaining(), 1000);
})
onBeforeUnmount(() => {
	clearInterval(interval);
})
</script>

<template>
	<div class="countdown flex align-items-center gap-1">
		<template v-if="pieces.d">
			<DigitTicker :qty="pieces.d || 0" direction="down" />
			:
		</template>
		<DigitTicker :qty="pieces.h || 0" :pad="2" direction="down" />
		:
		<DigitTicker :qty="pieces.m || 0" :pad="2" direction="down" />
		:
		<DigitTicker :qty="pieces.s || 0" :pad="2" direction="down" />
	</div>
</template>

<style lang="scss">
</style>
