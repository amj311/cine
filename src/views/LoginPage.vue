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

async function loginWithEmail() {
	try {
		state.isLoading = true;
		await AuthService.signInWithEmail(state.email, state.password);
		emit('authenticated');
	}
	catch (error: any) {
		userStore.loginError = error.message;
	}
	finally {
		state.isLoading = false;
	}
}
async function createEmailUser() {
	try {
		state.isLoading = true;
		await AuthService.createEmailUser(state.email, state.password, state.givenName, state.familyName);
		emit('authenticated');
	}
	catch (error: any) {
		userStore.loginError = error.message;
	}
	finally {
		state.isLoading = false;
	}
}
async function loginWithGoogle() {
	try {
		await AuthService.signInWithGoogle();
		emit('authenticated');
	}
	catch (error: any) {
		userStore.loginError = error.message;
	}
}

async function sendPasswordResetEmail() {
	try {
		await AuthService.sendPasswordResetEmail(state.email);
		state.hasSentEmail = true;
	}
	catch (error: any) {
		userStore.loginError = error.message;
	}
}

function leaveRestPasswordMode() {
	state.mode = 'login';
	state.email = '';
	state.hasSentEmail = false;
}

</script>


<template>
	<div
		class="flex flex-column gap-2 align-items-center justify-content-center mx-auto"
		style="width: 20em"
	>
		<Logo class="my-5" />
		<div
			v-if="userStore.loginError"
			class="bg-white border-round-3xl m-3"
		>
			{{ userStore.loginError }}
		</div>

		<div class="flex flex-column gap-1 w-full align-items-center">
			<p v-if="state.mode === 'reset_password'">
				<template v-if="!state.hasSentEmail">Enter your email to have a reset password link sent to
					you.</template>
				<template v-else>Thank you. If your email is in our system, you will receive your password reset link
					shortly.</template>
			</p>

			<InputText
				v-if="!(state.mode === 'reset_password' && state.hasSentEmail)"
				type="text"
				v-model="state.email"
				placeholder="Email"
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
						size="large"
						class="w-full"
					/>
					<InputGroupAddon style="padding: 0; cursor: pointer">
						<i
							class="pi"
							:class="state.showPassword ? 'pi-eye-slash' : 'pi-eye'"
							@click="state.showPassword = !state.showPassword"
						/>
					</InputGroupAddon>
				</template>
				
			</InputGroup>


			<template v-if="state.mode === 'signup'">
				<Button
					size="large"
					severity="primary"
					@click="createEmailUser"
					:loading="state.isLoading"
					class="w-full my-3 justify-content-around"
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
					@click="loginWithEmail"
					:loading="state.isLoading"
					class="w-full my-3 justify-content-around"
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
					@click="sendPasswordResetEmail"
					class="w-full my-3 justify-content-around"
				>Send Email</button>
				<small>Back to <span
						class="text-link"
						@click="leaveRestPasswordMode"
					>Sign in</span></small>
			</template>
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