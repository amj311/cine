<script
	setup
	lang="ts"
>

</script>

<template>
	<HideScrollbar style="height: 100%;">
		<div :style="{ height: '100%', maxHeight: '100%', overflowY: 'auto' }">
			<slot></slot>
		</div>
	</HideScrollbar>
</template>

<style lang="scss">
</style>
