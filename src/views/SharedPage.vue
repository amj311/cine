<script
	setup
	lang="ts"
>
import Logo from '@/components/Logo.vue';
import { AuthService } from '@/services/AuthService';
import { useUserStore } from '@/stores/user.store';

</script>

<template>
	<div class="flex flex-column align-items-center justify-content-center gap-5 text-center">
		<Logo class="mt-5" />
		<h3>Please contact the owner of this account to request access to media.</h3>
		<p>
			You are signed in as {{ useUserStore().currentUser.email }}.
			<br />
			Need to <a class="link" @click="() => AuthService.signOut()">logout</a>?
		</p>
	</div>
</template>

<style>
</style>
