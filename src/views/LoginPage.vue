<script
	setup
	lang="ts"
>
import { useUserStore } from '../stores/user.store';
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import { AuthService } from '@/services/AuthService';
import Logo from '@/components/Logo.vue';
import type Message from 'primevue/message';
import { useApiStore } from '@/stores/api.store';
import { getQrUrl } from '@/utils/qr';

const userStore = useUserStore();

const emit = defineEmits(['authenticated']);

const state = reactive({
	givenName: '',
	familyName: '',
	email: '',
	password: '',
	showPassword: false,
	mode: 'login',
	hasSentEmail: false,
	isLoading: false,
});

async function loginErrors(op: () => void) {
	try {
		state.isLoading = true;
		await op();
	}
	catch (error: any) {
		const errorGroups = [
			{
				message: 'Check your email/password',
				matches: [
					'auth/invalid-email',
					'auth/missing-password',
					'auth/weak-password',
					'auth/email-already-in-use',
				],
			},
			{
				message: 'Network error',
				matches: [
					'auth/network-request-failed',
				],
			}
		]
		for (const errorGroup of errorGroups) {
			if (errorGroup.matches.some(m => error.message?.includes(m))) {
				userStore.loginError = errorGroup.message;
				return;
			}
		}

		console.error(error.message);
		userStore.loginError = "Unknown error";
	}
	finally {
		state.isLoading = false;
	}
}

async function loginWithEmail() {
	loginErrors(async () => {
		await AuthService.signInWithEmail(state.email, state.password);
		emit('authenticated');
	})
}
async function createEmailUser() {
	loginErrors(async () => {
		await AuthService.createEmailUser(state.email, state.password, state.givenName, state.familyName);
		emit('authenticated');
	})
}
async function loginWithGoogle() {
	loginErrors(async () => {
		await AuthService.signInWithGoogle();
		emit('authenticated');
	})
}

async function sendPasswordResetEmail() {
	loginErrors(async () => {
		await AuthService.sendPasswordResetEmail(state.email);
		state.hasSentEmail = true;
	})
}

function leaveRestPasswordMode() {
	state.mode = 'login';
	state.email = '';
	state.hasSentEmail = false;
}


function doFormSubmit() {
	switch (state.mode) {
		case 'login': {
			loginWithEmail();
			break;
		}
		case 'reset_password': {
			sendPasswordResetEmail();
			break;
		}
		case 'signup': {
			createEmailUser();
			break
		}
	}
}




/*****************
 * CODE LOGIN
 */
const quickCode = ref('');
const validateUrl = computed(() => `web+oliveplex://validate-signin-code?code=${quickCode.value}`);
const validateCodeQr = computed(() => quickCode.value ? getQrUrl(validateUrl.value) : '');
// const validateCodeQr = computed(() => quickCode.value ? getQrUrl(location.origin + `/validate-signin-code?code=${quickCode.value}`) : '');
let checkCodeTimer = 0;
let discontinueTimer = 0;

async function beginCodeLogin() {
	state.mode = 'code_login';
	userStore.loginError = '';
	const { data } = await useApiStore().api.get('/auth/code');
	quickCode.value = data.data;
	checkCodeTimer = setInterval(checkCode, 5000);
	discontinueTimer = setInterval(() => {
		endQuickLogin();
		userStore.loginError = 'Timed out'
	}, 1000 * 60 * 5);
}

async function checkCode() {
	if (!quickCode.value) {
		return;
	}
	try {
		const { data: { success } } = await useApiStore().api.get('/auth/code/' + quickCode.value);
		if (success) {
			// Use AuthService function to fetch session
			// This will update user store and remove the login page
			await AuthService.restoreActiveSession();
		}
	}
	catch (e) {
		console.error(e);
	}
}

function endQuickLogin() {
	quickCode.value = '';
	state.mode = 'login';
	clearInterval(checkCodeTimer);
	clearInterval(discontinueTimer);
}

onBeforeUnmount(() => {
	clearInterval(checkCodeTimer);
	clearInterval(discontinueTimer);
})

</script>


<template>
	<div
		class="flex flex-column gap-2 align-items-center justify-content-center w-full mx-auto"
		style="max-width: 50rem"
	>
		<Logo class="my-5" />
		<Message
			severity="error"
			v-if="userStore.loginError"
			class="mb-3"
		>
			{{ userStore.loginError }}
		</Message>

		<template v-if="['reset_password', 'signup', 'login'].includes(state.mode)">
			<div class="flex flex-column gap-1 w-full align-items-center" style="width: 20em">
				<p v-if="state.mode === 'reset_password'">
					<template v-if="!state.hasSentEmail">
						Enter your email to have a reset password link sent to you.
					</template>
					<template v-else>
						Thank you. If your email is in our system, you will receive your password reset link shortly.
					</template>
				</p>

				<form @submit.prevent="doFormSubmit" class="flex-column gap-1">
					<InputText
						transparent
						v-if="!(state.mode === 'reset_password' && state.hasSentEmail)"
						type="text"
						v-model="state.email"
						placeholder="Email"
						autocomplete="username"
						size="large"
						class="w-full"
					/>

					<template v-if="state.mode === 'signup'">
						<InputText
							transparent
							type="text"
							v-model="state.givenName"
							placeholder="First Name"
							size="large"
							class="w-full"
						/>
						<InputText
							transparent
							type="text"
							v-model="state.familyName"
							placeholder="Last Name"
							size="large"
							class="w-full"
						/>
					</template>


					<InputGroup>
						<template v-if="state.mode === 'signup' || state.mode === 'login'">
							<InputText
								transparent
								v-model="state.password"
								placeholder="Password"
								:type="state.showPassword ? 'text' : 'password'"
								:autocomplete="state.mode === 'signup' ? 'new-password' : 'current-password'"
								size="large"
								class="w-full"
							/>
							<InputGroupAddon
								transparent
								style="cursor: pointer"
								@click="state.showPassword = !state.showPassword"
								tabindex="0"
							>
								<i
									class="pi"
									:class="state.showPassword ? 'pi-eye-slash' : 'pi-eye'"
								/>
							</InputGroupAddon>
						</template>
					</InputGroup>


					<div class="flex flex-column align-items-center mt-3 gap-4">
						<template v-if="state.mode === 'signup'">
							<Button
								size="large"
								severity="primary"
								:loading="state.isLoading"
								class="w-full my-3 justify-content-around"
								role="submit"
							>
								Create Account
							</button>
							<small>
								Already have an account?
								<a
									class="link text-primary"
									@click="state.mode = 'login'"
								>
									Sign in
								</a>
							</small>
						</template>
						<template v-else-if="state.mode === 'login'">
							<div class="flex-column align-items-center gap-2 w-full">
								<Button
									size="large"
									severity="primary"
									:loading="state.isLoading"
									class="w-full justify-content-around"
									role="submit"
									@click="doFormSubmit"
								>
									Sign in
								</button>
								<div>or</div>
								<Button
									size="large"
									severity="contrast"
									class="w-full justify-content-around"
									@click="beginCodeLogin"
									label="Quick Login"
								/>	
							</div>
							<div class="flex-column align-items-center gap-2">
								<small>
									New here?
									<a
										class="link text-primary"
										@click="state.mode = 'signup'"
									>
										Create account
									</a>
								</small>
								<small>
									<a
										class="link text-primary"
										@click="state.mode = 'reset_password'"
									>
										Forgot password?
									</a>
								</small>
							</div>
						</template>
						<template v-else-if="state.mode === 'reset_password'">
							<Button
								size="large"
								v-if="!state.hasSentEmail"
								role="submit"
								class="w-full my-3 justify-content-around"
							>Send Email</button>
							<small>Back to <a
									class="link text-primary"
									@click="leaveRestPasswordMode"
								>Sign in</a></small>
						</template>
					</div>
					<input type="submit" hidden />
				</form>
			</div>
		</template>

		<template v-if="['code_login'].includes(state.mode)">
			<div v-if="!quickCode" class="flex-center-all">
				<i class="pi pi-spin pi-spinner" />
			</div>

			<div v-else class="w-full" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));">

				<div class="p-3">
					<div class="flex-column align-items-center gap-3">
						<h2>Quick Login</h2>
						<ol>
							<li class="p-2">
								<div>Scan the QR on a device with OlivePlex installed</div>
								<div class="mt-2">Or go to Settings > Quick Login</div>
							</li>
							<li class="p-2">Confirm the verification code</li>
						</ol>
						<div class="bg-blur border-round p-3 flex gap-2 text-3xl font-medium">
							<span v-for="digit in quickCode">{{ digit }}</span>
						</div>
						<Button btn-hover-blur text icon="pi pi-arrow-left" label="Back to login" @click="endQuickLogin" />
					</div>
				</div>
				<div class="p-3">
					<div class="flex-center-all w-full">
						<a target="_blank" :href="validateUrl"><img :src="validateCodeQr" class="border-round-xl" style="border: 1em solid #fff" /></a>
					</div>
				</div>
			</div>

		</template>

		<!-- GOOGLE SIGN-IN NOT WORKING!!!!
		<div>or</div>

		<Button
			size="large" @click="loginWithGoogle" outlined class="w-full justify-content-between gap-2"><i class="pi pi-google" /><div class="flex-grow-1 text-align-center">Sign in with Google</div></button> -->
	</div>
</template>


<style scoped>
.login {
	text-align: center;
	padding-top: 5em;
}
</style>