<script
	setup
	lang="ts"
>
import { getBuildNumber } from '@/services/versionService';
import { useAppNavigationStore } from '@/stores/appNavigation.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { useNavigationStore } from '@/stores/tvNavigation.store';
import { useUserStore } from '@/stores/user.store';
import Button from 'primevue/button';
import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import DropdownMenu from './utils/DropdownMenu.vue';
import SettingsModal from './SettingsModal.vue';
import { AuthService } from '@/services/AuthService';

const navStore = useAppNavigationStore();
const lastClickedItem = ref<string | null>(null);

const useMobileNav = computed(() => useNavigationStore().isSkinnyScreen);
const expandMobileNav = ref(false);
const queryPathStore = useQueryPathStore();


const props = defineProps<{
}>()

const showRootNavigation = computed(() => {
	return queryPathStore.currentDir.length < 2;
});

const isInMediaFolder = computed(() => Boolean(queryPathStore.currentFile?.match(/\(\d{4}\)/g)));

function removeExtensionsFromFileName(filename: string) {
	// Extensions are everything after a '.' AFTER any spaces
	// Regexp for extension: a . followed by anything other than a space
	return filename.split(RegExp(/\.[\S]{1,50}/g))[0] || filename;
}

const navPathItems = computed(() => {
	const pathItems = queryPathStore.currentDir.slice(1, -1).map((dir) => ({
		folderName: dir,
		label: removeExtensionsFromFileName(dir),
		command: () => {
			queryPathStore.goToAncestor(dir);
		},
	}));
	// include the current folder if it is not a media item
	if (queryPathStore.currentFile && !isInMediaFolder.value && queryPathStore.currentFile !== queryPathStore.rootLibrary) {
		pathItems.push({
			folderName: queryPathStore.currentFile,
			label: removeExtensionsFromFileName(queryPathStore.currentFile!),
		} as any);
	}
	return pathItems;
});

const numHiddenBreadcrumbs = computed(() => Math.max(0, navPathItems.value.length - 2));
const hiddenBreadcrumbs = computed(() => (navPathItems.value.slice(0, numHiddenBreadcrumbs.value)));
const visibleBreadcrumbs = computed(() => (navPathItems.value.slice(numHiddenBreadcrumbs.value)));

const singleNavLabel = computed(() => navPathItems[navPathItems.value.length - 1]?.label || removeExtensionsFromFileName(queryPathStore.currentFile || ''));


/** USER */
const avatarInitial = computed(() => useUserStore().currentUser?.email?.[0]);


const settingsModal = ref<InstanceType<typeof SettingsModal>>();
</script>

<template>
	<div class="navbar" :class="{ 'mobile-expanded': expandMobileNav }">
		<div class="top">
			<div class="logo" tabindex="0" @click="() => { expandMobileNav = false; $router.push({ name: 'home' }) }">
				<Logo :width="125" />
				<div class="build-version">v{{ getBuildNumber() }}</div>
			</div>

			<div v-if="useMobileNav" style="flex-grow: 1; min-width: 0;">
				<Button
					v-if="!expandMobileNav"
					variant="text"
					severity="contrast"
					@click="expandMobileNav = !expandMobileNav"
					style="max-width: 100%;"
				>
					<div v-if="singleNavLabel" class="text-ellipsis">{{ singleNavLabel }}</div>
					<i class="pi pi-angle-down" />
				</Button>
			</div>

			<!-- Starting point libraries -->
			<div class="flex align-items-center" v-else-if="showRootNavigation">
				<Button
					v-for="library in navStore.libraries"
					:key="library.relativePath"
					:label="library.libraryItem?.name || library.folderName"
					variant="text"
					:severity="($route?.query?.path as any)?.startsWith(library.relativePath) ? 'contrast' : 'secondary'"
					@click="$router.push({ name: 'browse', query: { path: library.relativePath } })"
				/>
			</div>

			<div v-else-if="$route.name === 'browse'" class="breadcrumbs" :class="{ bg: isInMediaFolder }">
				<Button @click="() => queryPathStore.goToAncestor(queryPathStore.rootLibrary!)" style="cursor: pointer" variant="text" severity="secondary">{{ queryPathStore.rootLibrary }}</button>
				<template v-if="hiddenBreadcrumbs.length > 0">
					<i class="pi pi-angle-right opacity-50" />
					<DropdownMenu :model="hiddenBreadcrumbs"><Button variant="text" severity="secondary">...</Button></DropdownMenu>
				</template>
				<template v-for="item in visibleBreadcrumbs" :key="item.label">
					<i class="pi pi-angle-right opacity-50" />
					<Button
						@click="item.command"
						variant="text"
						:severity="($route?.query?.path as any)?.endsWith(item.folderName) ? 'contrast' : 'secondary'"
					>
						{{ item.label }}
					</button>
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

			<div>
				<DropdownMenu :items="[
					{ label: useUserStore().currentUser?.email, icon: 'pi pi-user', disabled: true },
					{ label: 'Settings', icon: 'pi pi-cog', command: settingsModal?.open, },
					{ label: 'Sign out', icon: 'pi pi-sign-out', command: AuthService.signOut },
				]">
					<div class="square w-2rem h-2rem border-circle overflow-hidden border-1 border-white-alpha-30 text-upper flex-center-all no-select bg-black-alpha-30 cursor-pointer">
						<template v-if="avatarInitial">{{avatarInitial}}</template>
						<i v-else class="pi pi-user"></i>
					</div>
				</DropdownMenu>
			</div>

		</div>

		<div class="mobile-nav" :class="{ tvNavigationNoFocus: !expandMobileNav }" @click="expandMobileNav = false">
			<div class="flex flex-column" v-if="expandMobileNav">
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
						{{ library.libraryItem?.name || library.folderName }}
					</Button>
					<template v-if="library.relativePath === queryPathStore.rootLibrary">
						<Button
							v-for="item in navPathItems"
							variant="text"
							class="subpath"
							@click="item.command"
							:key="item.label"
							:severity="($route?.query?.path as any)?.endsWith(item.folderName) ? 'contrast' : 'secondary'"
						>
							{{ item.label }}
						</Button>
					</template>
				</template>
			</div>
		</div>
	</div>

	<SettingsModal ref="settingsModal" />
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
	position: relative;
	perspective: 80px;
	cursor: pointer;

	svg {
		transform: rotateX(0deg);
		transition: transform 0.4s ease-out;
		transform-style: preserve-3d;
		pointer-events: none;
	}
	&:hover svg, &:active svg {
		transform: rotateX(-360deg);
	}

	.build-version {
		position: absolute;
		bottom: 50%;
		left: 0;
		font-size: 0.8rem;
		opacity: 0;
	}


	&:hover, &:focus {
		svg {
			transform: rotateX(-360deg);
		}
		.build-version {
			opacity: .8;
			bottom: -1.2rem;
			transition: 1s ease-in-out 5s;
		}
	}

}

.breadcrumbs {
	white-space: nowrap;
	border-radius: 5px;

	&.bg {
		background-image: linear-gradient(to right, #00000011, #00000055);
	}

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
