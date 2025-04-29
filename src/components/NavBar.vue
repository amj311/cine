<script
	setup
	lang="ts"
>
import { useAppNavigationStore } from '@/stores/appNavigation.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import Button from 'primevue/button';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const navStore = useAppNavigationStore();
const lastClickedItem = ref<string | null>(null);

const useMobileNav = ref(window.innerWidth < 768);
const expandMobileNav = ref(false);
const queryPathStore = useQueryPathStore();

function updateMobileNav() {
	useMobileNav.value = window.innerWidth < 768;
}
onMounted(() => {
	window.addEventListener('resize', updateMobileNav);
	updateMobileNav();
});
onUnmounted(() => {
	window.removeEventListener('resize', updateMobileNav);
});

const props = defineProps<{
}>()

const showRootNavigation = computed(() => {
	return queryPathStore.currentDir.length < 2;
});

const hiddenAncestors = computed(() => (queryPathStore.currentDir.slice(1, -2) || []).map((dir) => ({
	label: dir,
	command: () => {
		queryPathStore.goToAncestor(dir);
	},
})));

</script>

<template>
	<div class="navbar" :class="{ 'mobile-expanded': expandMobileNav }">
		<div class="top">
			<div class="logo" tabindex="0" @click="() => { expandMobileNav = false; $router.push({ name: 'home' }) }">
				<Logo :width="125" />
			</div>

			<div v-if="useMobileNav">
				<Button
					v-if="!expandMobileNav"
					variant="text"
					severity="contrast"
					@click="expandMobileNav = !expandMobileNav"
				>
					{{ queryPathStore.rootLibrary }}
					<i class="pi pi-angle-down" />
				</Button>
			</div>

			<!-- Starting point libraries -->
			<div class="flex align-items-center" v-else-if="showRootNavigation">
				<Button
					v-for="library in navStore.libraries"
					:key="library.relativePath"
					:label="library.name"
					variant="text"
					:severity="($route?.query?.path as any)?.startsWith(library.relativePath) ? 'contrast' : 'secondary'"
					@click="$router.push({ name: 'browse', query: { path: library.relativePath } })"
				/>
			</div>

			<div v-else-if="$route.name === 'browse'" class="breadcrumbs">
				<Button @click="() => queryPathStore.goToAncestor(queryPathStore.rootLibrary!)" style="cursor: pointer" variant="text" severity="secondary">{{ queryPathStore.rootLibrary }}</button>
				<template v-if="hiddenAncestors.length > 0">
					<i class="pi pi-angle-right opacity-50" />
					<DropdownMenu :model="hiddenAncestors"><Button variant="text" severity="secondary">...</Button></DropdownMenu>
				</template>
				<template v-if="queryPathStore.parentFile && queryPathStore.parentFile !== queryPathStore.rootLibrary">
					<i class="pi pi-angle-right opacity-50" />
					<Button @click="queryPathStore.goUp" style="cursor: pointer;" variant="text" severity="secondary">{{ queryPathStore.parentFile }}</button>
					</template>
				<template v-if="queryPathStore.currentFile && !queryPathStore.currentFile.match(/\(\d{4}\)/g)">
					<i class="pi pi-angle-right opacity-50" />
					<Button variant="text" severity="contrast" style="pointer-events: none" tabindex="-1">{{ queryPathStore.currentFile }}</Button>
				</template>
			</div>

			<div class="flex-grow-1" />

			<div v-if="useMobileNav && expandMobileNav">
				<Button
					variant="text"
					severity="contrast"
					@click="expandMobileNav = !expandMobileNav"
				>
					<i class="pi pi-times" />
				</Button>
			</div>
		</div>

		<div class="mobile-nav" @click="expandMobileNav = false">
			<div class="flex flex-column">
				<template 
					v-for="library in navStore.libraries"
					:key="library.relativePath"
				>
					<Button
						variant="text"
						size="large"
						:severity="($route?.query?.path as any)?.startsWith(library.relativePath) ? 'contrast' : 'secondary'"
						@click="$router.push({ name: 'browse', query: { path: library.relativePath } })"
					>
						{{ library.name }}
					</Button>
					<template v-if="library.relativePath === queryPathStore.rootLibrary">
						<Button
							v-for="folder in queryPathStore.currentDir.slice(1, -1)"
							variant="text"
							class="subpath"
							@click="queryPathStore.goToAncestor(folder)"
							:key="folder"
							severity="secondary"
						>
							{{ folder }}
						</Button>
					</template>
				</template>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
.navbar {
	min-height: 0;
	overflow: hidden;
	transition: all 0.4s ease-out;
	background-color: transparent;

	&.mobile-expanded {
		min-height: 100vh;
		background-color: #00000033;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1rem;
		gap: 1em;
	}
}

.logo {
	perspective: 80px;
	cursor: pointer;

	svg {
		transform: rotateX(0deg);
		transition: transform 0.4s ease-out;
		transform-style: preserve-3d;
		pointer-events: none;
	}
	&:hover svg {
		transform: rotateX(-360deg);
	}
}

.breadcrumbs {
	background-image: linear-gradient(to right, #00000022, #00000055);
	white-space: nowrap;
	border-radius: 5px;

	button.p-button {
		display: inline-block;
		text-align: left;
	}
}

.mobile-nav {
	max-height: 0vh;
	overflow: hidden;
	transition: all 0.3s ease-out;

	.p-button {
		justify-content: flex-start;

		&.subpath {
			padding-left: 2em;
		}
	}
}

.mobile-expanded .mobile-nav {
	max-height: 100vh;
	transition: all 0.4s ease-out;
}
</style>
