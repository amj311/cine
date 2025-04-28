<script
	setup
	lang="ts"
>
import { useAppNavigationStore } from '@/stores/appNavigation.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import Button from 'primevue/button';
import { computed, ref } from 'vue';

const navStore = useAppNavigationStore();
const lastClickedItem = ref<string | null>(null);

const queryPathStore = useQueryPathStore();

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
	<div class="navbar">
		<div class="logo" tabindex="0" @click="$router.push({ name: 'home' })">
			<Logo :width="125" />
		</div>

		<!-- Starting point libraries -->
		<div class="flex align-items-center" v-if="showRootNavigation">
			<Button
				v-for="library in navStore.libraries"
				:key="library.relativePath"
				:label="library.name"
				variant="text"
				:severity="($route?.query?.path as any)?.startsWith(library.relativePath) ? 'contrast' : 'secondary'"
				@click="$router.push({ name: 'browse', query: { path: library.relativePath } })"
			/>
		</div>

		<div v-else-if="$route.name === 'browse'" class="flex align-items-center breadcrumbs">
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
	</div>
</template>

<style lang="scss">
.navbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1rem 1rem;
	background-color: var(--surface-a);
	box-shadow: var(--box-shadow);
	gap: 1em;
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

.breadcrumbs button.p-button {
	text-align: left;
	text-shadow: 0 0 5px #000000;
}
</style>
