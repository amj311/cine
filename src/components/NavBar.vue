<script
	setup
	lang="ts"
>
import { getBuildNumber } from '@/services/versionService';
import { useAppNavigationStore } from '@/stores/appNavigation.store';
import { useQueryPathStore } from '@/stores/queryPath.store';
import { focusAreaClass, useScreenStore } from '@/stores/screen.store';
import { useUserStore } from '@/stores/user.store';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import DropdownMenu from './utils/DropdownMenu.vue';
import SettingsModal from './SettingsModal.vue';
import { AuthService } from '@/services/AuthService';
import { encodeMediaPath } from '@/utils/miscUtils';
import SharingModal from './SharingModal.vue';
import NavTrigger from './utils/NavTrigger/NavTrigger.vue';
import router from '@/router/router';
import { useSettingsStore } from '@/stores/settings.store';

const navStore = useAppNavigationStore();
const queryPathStore = useQueryPathStore();

const useMobileNav = computed(() => useScreenStore().isSkinnyScreen);
const mobileTrigger = ref<InstanceType<typeof NavTrigger>>();
const expandMobileNav = computed(() => mobileTrigger.value?.show);

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
	const pathItems = queryPathStore.currentDir.slice(1).map((dir) => ({
		folderName: dir,
		label: removeExtensionsFromFileName(dir),
		command: () => {
			queryPathStore.goToAncestor(dir);
		},
	}));
	// // include the current folder if it is not a media item
	// if (queryPathStore.currentFile && !isInMediaFolder.value && queryPathStore.currentFile !== queryPathStore.rootLibrary) {
	// 	pathItems.push({
	// 		folderName: queryPathStore.currentFile,
	// 		label: removeExtensionsFromFileName(queryPathStore.currentFile!),
	// 	} as any);
	// }
	return pathItems;
});

const maxVisibleBreadcrumbs = 2;
const numHiddenBreadcrumbs = computed(() => Math.max(0, navPathItems.value.length - maxVisibleBreadcrumbs));
const hiddenBreadcrumbs = computed(() => (navPathItems.value.slice(0, numHiddenBreadcrumbs.value)));
const visibleBreadcrumbs = computed(() => (navPathItems.value.slice(numHiddenBreadcrumbs.value)));

/** USER */
const avatarInitial = computed(() => useUserStore().currentUser?.email?.[0]);

const settingsModal = ref<InstanceType<typeof SettingsModal>>();
const sharingModal = ref<InstanceType<typeof SharingModal>>();
const nowPlayingMode = computed(() => useSettingsStore().localSettings.now_playing_mode);
</script>

<template>
	<div class="navbar" :class="{ [`mobile-expanded ${focusAreaClass}`]: expandMobileNav }">
		<div class="top">
			<div class="logo" tabindex="0" @click="() => { $router.push({ name: 'home' }) }">
				<Logo :width="useScreenStore().isSkinnyScreen ? 100 : 115" />
				<div class="build-version">v{{ getBuildNumber() }}</div>
			</div>

			<div v-if="useMobileNav && !nowPlayingMode" style="flex-grow: 1; min-width: 0;">
				<Button
					v-if="!expandMobileNav"
					variant="text"
					severity="contrast"
					@click="() => mobileTrigger?.open()"
					style="max-width: 100%;"
				>
					<div class="text-ellipsis" v-if="queryPathStore.currentFile">{{ removeExtensionsFromFileName(queryPathStore.currentFile || '') }}</div>
					<i class="pi pi-angle-down" />
				</Button>
			</div>

			<!-- Starting point libraries -->
			<div class="flex align-items-center" v-else-if="showRootNavigation && !nowPlayingMode">
				<Button
					v-for="library in navStore.libraries"
					:key="library.relativePath"
					:label="library.libraryItem?.name || library.folderName"
					variant="text"
					btn-blur-hover
					:severity="($route?.query?.path as any)?.startsWith(encodeMediaPath(library.relativePath)) ? 'contrast' : 'secondary'"
					@click="useQueryPathStore().goTo(library.relativePath)"
				/>
			</div>

			<div v-else-if="$route.name === 'browse' && !nowPlayingMode" class="breadcrumbs ml-1" :class="{ bg: isInMediaFolder }">
				<Button btn-blur-hover @click="() => queryPathStore.goToAncestor(queryPathStore.rootLibrary!)" style="cursor: pointer" variant="text" severity="secondary">{{ queryPathStore.rootLibrary }}</button>
				<template v-if="hiddenBreadcrumbs.length > 0">
					<i class="pi pi-angle-right opacity-50" />
					<DropdownMenu :items="hiddenBreadcrumbs"><Button btn-blur-hover variant="text" severity="secondary">...</Button></DropdownMenu>
				</template>
				<template v-for="item in visibleBreadcrumbs" :key="item.label">
					<i class="pi pi-angle-right opacity-50" />
					<Button
						@click="item.command"
						variant="text"
						btn-blur-hover
						:severity="($route?.query?.path as any)?.endsWith(encodeMediaPath(item.folderName)) ? 'contrast' : 'secondary'"
						class="text-ellipsis"
					>
						{{ item.label }}
					</button>
				</template>
			</div>

			<div class="flex-grow-1" />

			<Button
				btn-blur-hover
				btn-drop-shadow
				v-if="!nowPlayingMode && queryPathStore.currentPath && useUserStore().currentUser.isOwner && (!useScreenStore().isSkinnyScreen || expandMobileNav)"
				text
				size="small text-5xl"
				severity="contrast"
				class="flex-shrink-0"
				@click="sharingModal?.open"
			>
				<template #icon><i class="pi pi-users text-xl" /></template>
			</Button>

			<div v-if="useMobileNav && expandMobileNav">
				<Button
					variant="text"
					severity="contrast"
					icon="pi pi-times"
					btn-blur-hover
					btn-drop-shadow
					@click="() => mobileTrigger?.close()"
				/>
			</div>

			<div>
				<DropdownMenu :items="[
					{ label: useUserStore().currentUser?.email, icon: 'pi pi-user', disabled: true },
					{ label: 'Timer', icon: 'pi pi-clock', command: () => router.push('/remote') },
					{ label: 'Settings', icon: 'pi pi-cog', command: settingsModal?.open, },
					{ label: 'Quick Login', icon: 'pi pi-unlock', command: () => router.push('/validate-signin-code'), },
					{ label: 'Sign out', icon: 'pi pi-sign-out', command: AuthService.signOut },
				]">
					<div class="square w-2rem h-2rem border-circle overflow-hidden border-1 border-white-alpha-30 text-upper flex-center-all no-select bg-black-alpha-30 cursor-pointer">
						<template v-if="avatarInitial">{{avatarInitial}}</template>
						<i v-else class="pi pi-user"></i>
					</div>
				</DropdownMenu>
			</div>

		</div>

		<NavTrigger
			ref="mobileTrigger"
		>
			<template #default="{ show }">
				<div class="mobile-nav" v-if="useMobileNav">
					<div class="flex flex-column" v-if="show">
						<template 
							v-for="library in navStore.libraries"
							:key="library.relativePath"
						>
							<Button
								variant="text"
								size="large"
								:severity="($route?.query?.path as any)?.startsWith(encodeMediaPath(library.relativePath)) ? 'contrast' : 'secondary'"
								@click="useQueryPathStore().goTo(library.relativePath)"
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
									:severity="($route?.query?.path as any)?.endsWith(encodeMediaPath(item.folderName)) ? 'contrast' : 'secondary'"
								>
									{{ item.label }}
								</Button>
							</template>
						</template>
					</div>
				</div>
			</template>
		</NavTrigger>
	</div>

	<SettingsModal ref="settingsModal" />
	<SharingModal ref="sharingModal" />
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
		gap: 5px;
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


	&:hover, &[tv-focus] {
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
