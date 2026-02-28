<script
	setup
	lang="ts"
>
import { onBeforeMount, ref } from 'vue';
import Button from 'primevue/button';
import { useApiStore } from '@/stores/api.store';
import { useRoute } from 'vue-router';
import type InputOtp from 'primevue/inputotp';
import { useToast } from 'primevue/usetoast';

const toast = useToast();
const route = useRoute();
const code = ref('');
const validated = ref(false);

onBeforeMount(() => {
	const queryCode = typeof route.query.code === 'string' && !isNaN(Number(route.query.code)) ? route.query.code : '';
	code.value = queryCode || '';
})

async function validateCode() {
	if (!code.value || code.value.length !== 6) {
		return;
	}

	try {
		await useApiStore().api.post(`/auth/code/${code.value}/validate`);
		validated.value = true;
	}
	catch (e) {
		console.error(e);
		toast.add({
			life: 3000,
			severity: 'error',
			summary: 'Failed to validate code',
		})
	}
}

</script>


<template>
	<div
		class="flex flex-column gap-4 align-items-center justify-content-center w-full mx-auto"
		style="width: 25rem"
	>
		<template v-if="!validated">
			<h2>Quick Login</h2>

			<p v-if="!code || code.length < 6">
				Enter the validation code form your other device
			</p>
			<p v-else>
				Is this the correct code?
			</p>

			<InputOtp :length="6" v-model="code" size="large" integerOnly />
			<Button label="Confirm" size="large" @click="validateCode" />
		</template>
		<template v-else>
			<h2>Success!</h2>
			<p>
				Your other device will login in a few moments.
			</p>
		</template>
	</div>
</template>


<style scoped>
.login {
	text-align: center;
	padding-top: 5em;
}
</style>