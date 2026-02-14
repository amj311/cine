<script
	setup
	lang="ts"
>
import { useUserStore } from '../stores/user.store';
import { reactive } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import { AuthService } from '@/services/AuthService';
import Logo from '@/components/Logo.vue';
import type Message from 'primevue/message';

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

// if (userStore.currentUser) {
// 	const redirect = new URL(window.location.href).searchParams.get('redirect');
// 	useIonRouter().push(redirect || '/');
// }

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
		}
		case 'reset_password': {
			sendPasswordResetEmail();
		}
		case 'signup': {
			createEmailUser();
		}
	}
}
</script>


<template>
	<div
		class="flex flex-column gap-2 align-items-center justify-content-center mx-auto"
		style="width: 20em"
	>
		<Logo class="my-5" />
		<Message
			severity="error"
			v-if="userStore.loginError"
			class="mb-3"
		>
			{{ userStore.loginError }}
		</Message>

		<div class="flex flex-column gap-1 w-full align-items-center">
			<p v-if="state.mode === 'reset_password'">
				<template v-if="!state.hasSentEmail">Enter your email to have a reset password link sent to
					you.</template>
				<template v-else>Thank you. If your email is in our system, you will receive your password reset link
					shortly.</template>
			</p>

			<form @submit.prevent="doFormSubmit">
				<InputText
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
						type="text"
						v-model="state.givenName"
						placeholder="First Name"
						size="large"
						class="w-full"
					/>
					<InputText
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
							v-model="state.password"
							placeholder="Password"
							:type="state.showPassword ? 'text' : 'password'"
							:autocomplete="state.mode === 'signup' ? 'new-password' : 'current-password'"
							size="large"
							class="w-full"
						/>
						<InputGroupAddon
							style="cursor: pointer"
							@click="state.showPassword = !state.showPassword"
						>
							<i
								class="pi"
								:class="state.showPassword ? 'pi-eye-slash' : 'pi-eye'"
							/>
						</InputGroupAddon>
					</template>
				</InputGroup>


				<div class="flex flex-column align-items-center gap-2">
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
							<span
								class="text-link"
								@click="state.mode = 'login'"
							>
								Sign in
							</span>
						</small>
					</template>
					<template v-else-if="state.mode === 'login'">
						<Button
							size="large"
							severity="primary"
							:loading="state.isLoading"
							class="w-full my-3 justify-content-around"
							role="submit"
							@click="doFormSubmit"
						>
							Sign in
						</button>
						<small>
							New here?
							<span
								class="text-link"
								@click="state.mode = 'signup'"
							>
								Create account
							</span>
						</small>
						<small>
							<span
								class="text-link"
								@click="state.mode = 'reset_password'"
							>
								Forgot password?
							</span>
						</small>
					</template>
					<template v-else-if="state.mode === 'reset_password'">
						<Button
							size="large"
							v-if="!state.hasSentEmail"
							role="submit"
							class="w-full my-3 justify-content-around"
						>Send Email</button>
						<small>Back to <span
								class="text-link"
								@click="leaveRestPasswordMode"
							>Sign in</span></small>
					</template>
				</div>
				<input type="submit" hidden />
			</form>
		</div>
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