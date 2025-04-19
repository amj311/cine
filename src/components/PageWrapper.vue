<script
	setup
	lang="ts"
>
</script>

<template>
	<div class="hide-scrollbar" style="height: 100vh; padding: 10px">
		<div :style="{ height: '100%', maxHeight: '100%', overflowY: 'auto', padding: 20 }">
			<slot></slot>
		</div>div>
	</div>
</template>

<style lang="scss">
</style>
