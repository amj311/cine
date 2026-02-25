<script
	setup
	lang="ts"
>
import { AuthService } from '@/services/AuthService';
import { useUserStore } from '@/stores/user.store';

</script>

<template>
	<div class="flex flex-column align-items-center justify-content-center gap-2 text-center">
		<h3>Hmm, looks a little empty...</h3>
		<template v-if="!useUserStore().currentUser.isOwner">
			<div>Request access to media from the drive owner.</div>
			<div>Need to <a class="link" @click="() => AuthService.signOut()">logout</a>?</div>
		</template>
	</div>
</template>

<style>
</style>
