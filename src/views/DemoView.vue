<script setup lang="ts">
import Logo from '@/components/Logo.vue';
import { AuthService } from '@/services/AuthService';
import { useBackgroundStore } from '@/stores/background.store';
import Button from 'primevue/button';
import type Message from 'primevue/message';
import { onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();


onMounted(() => {
	useBackgroundStore().setPosterUrl('/public/gallery.png', { shape: 'square'});
})

onBeforeUnmount(() => {
	useBackgroundStore().clearPosterUrl();
});

const loggingIn = ref(false);
const loginError = ref(false);
async function loginToDemo() {
	try {
		loggingIn.value = true;
		loginError.value = false;
		await AuthService.signInWithEmail(import.meta.env.VITE_DEMO_EMAIL, import.meta.env.VITE_DEMO_PASS);
		router.push('/');
	}
	catch (e) {
		console.error("Could not log in")
		console.log(e);
		loginError.value = true;
	}
	finally {
		loggingIn.value = false;
	}
}
</script>

<template>
  <div class="demo-page">
    
	<div class="hero">
		<h1 class="flex-row-center justify-content-start gap-3">Welcome to <Logo /></h1>
		<h3>A feature-rich private home media server</h3>
	</div>
	

	<div class="mt-4">
		<p>A demo account has been created with a subset of my library available to explore.</p>
		<p>Only the movies under the "Blender Open Movies" folder are streamable, so some playback features will be unavailable.</p>
		<p>Happy streaming!</p>
		<br />
		<Button size="large" icon="pi pi-play" label="Go to demo" @click="loginToDemo" :loading="loggingIn" />
		<br />
		<br />
		<Message v-if="loginError" severity="error" style="display: inline-flex">Sorry, couldn't log in to the demo!</Message>
	</div>
  </div>
</template>


<style scoped>
.demo-page {
  padding: 2rem;
}

.demo-page h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.hero {
	min-height: min(40vw, 20rem);

	display: flex;
	flex-direction: column;
	justify-content: center;
}
</style>
