<script
	setup
	lang="ts"
>

defineProps<{
	progress: number,
}>()
</script>

<template>
	<div class="progress-bar">
		<div class="inner bg-accent" :style="{ width: `${progress}%` }"></div>
	</div>
</template>

<style lang="scss">
	.inner {
		height: 7px;
	}
</style>
