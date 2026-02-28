<script
	setup
	lang="ts"
>
import { onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onBeforeMount(() => {
	const protocolPath = (router.currentRoute.value?.query.path as string)?.split('://')[1];
	if (protocolPath) {
		router.replace(protocolPath)
	}
})

</script>


<template>
	<div
		class="flex flex-center-all mt-5"
	>
		<i class="pi pi-spin pi-spinner text-3xl" />
	</div>
</template>


<style scoped>
.login {
	text-align: center;
	padding-top: 5em;
}
</style>