<script setup lang="ts">
import { ref } from 'vue';
import NavModal from './utils/NavModal.vue';
import ProfileEditModal from './ProfileEditModal.vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useProfileStore, type Profile } from '@/stores/profile.store';
import { useUserStore } from '@/stores/user.store';

const modal = ref<InstanceType<typeof NavModal>>();
const editModal = ref<InstanceType<typeof ProfileEditModal>>();
const toast = useToast();
const profileStore = useProfileStore();
const userStore = useUserStore();

async function deleteProfile(profile: Profile) {
	try {
		await profileStore.deleteProfile(profile.id);
		toast.add({ severity: 'success', summary: `Deleted "${profile.name}"`, life: 2500 });
	} catch (e) {
		toast.add({ severity: 'error', summary: 'Failed to delete profile', life: 3000 });
	}
}

function copyProfileLink(profile: Profile) {
	const url = new URL(window.location.origin);
	url.searchParams.set('profile', profile.id);
	navigator.clipboard.writeText(url.toString());
	toast.add({ severity: 'success', summary: 'Link copied', life: 2000 });
}

function switchTo(id: string | null) {
	profileStore.setActiveProfile(id);
	modal.value?.close();
}

defineExpose({
	open: () => modal.value?.open(),
	close: () => modal.value?.close(),
});
</script>

<template>
	<NavModal ref="modal" :width="'26rem'">
		<template #header>
			<h3 style="margin: 0;">Profiles</h3>
		</template>

		<div class="profiles-modal">

			<!-- Default profile row -->
			<div
				class="profile-row"
				:class="{ active: profileStore.isDefaultProfile }"
				@click="switchTo(null)"
			>
				<div class="profile-info">
					<span class="profile-name">Default</span>
					<span class="profile-email">{{ userStore.currentUser?.email }}</span>
				</div>
				<div class="profile-actions">
					<span class="mode-badge full">Full</span>
					<Button
						v-if="profileStore.isDefaultProfile"
						icon="pi pi-check"
						variant="text"
						severity="contrast"
						size="small"
						disabled
					/>
					<Button
						v-else
						label="Switch"
						variant="text"
						severity="secondary"
						size="small"
						@click.stop="switchTo(null)"
					/>
				</div>
			</div>

			<!-- Named profiles -->
			<div
				v-for="profile in profileStore.profiles"
				:key="profile.id"
				class="profile-row"
				:class="{ active: profileStore.activeProfileId === profile.id }"
				@click="switchTo(profile.id)"
			>
				<div class="profile-info">
					<span class="profile-name">{{ profile.name }}</span>
				</div>
				<div class="profile-actions">
					<span class="mode-badge" :class="profile.mode">{{ profile.mode === 'theater' ? 'Theater' : 'Full' }}</span>

					<template v-if="profileStore.isDefaultProfile">
						<Button
							icon="pi pi-link"
							variant="text"
							severity="secondary"
							size="small"
							v-tooltip.top="'Copy link'"
							@click.stop="copyProfileLink(profile)"
						/>
						<Button
							icon="pi pi-pencil"
							variant="text"
							severity="secondary"
							size="small"
							@click.stop="editModal?.openForEdit(profile)"
						/>
						<Button
							icon="pi pi-trash"
							variant="text"
							severity="danger"
							size="small"
							@click.stop="deleteProfile(profile)"
						/>
					</template>

					<Button
						v-if="profileStore.activeProfileId === profile.id"
						icon="pi pi-check"
						variant="text"
						severity="contrast"
						size="small"
						disabled
					/>
					<Button
						v-else
						label="Switch"
						variant="text"
						severity="secondary"
						size="small"
						@click.stop="switchTo(profile.id)"
					/>
				</div>
			</div>

			<!-- Add profile -->
			<div v-if="profileStore.isDefaultProfile" class="add-profile-btn">
				<Button icon="pi pi-plus" label="Add Profile" variant="text" severity="secondary" @click="editModal?.openForAdd()" />
			</div>
		</div>
	</NavModal>

	<ProfileEditModal ref="editModal" />
</template>

<style scoped lang="scss">
.profiles-modal {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.profile-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding: 0.6rem 0.75rem;
	border-radius: 6px;
	cursor: pointer;
	transition: background 0.15s;

	&:hover {
		background: #ffffff10;
	}

	&.active {
		background: #ffffff18;
		outline: 1px solid #ffffff30;
	}
}

.profile-info {
	display: flex;
	flex-direction: column;
	min-width: 0;

	.profile-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.profile-email {
		font-size: 0.78rem;
		opacity: 0.55;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}

.profile-actions {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	flex-shrink: 0;
}

.mode-badge {
	font-size: 0.7rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	padding: 0.15rem 0.45rem;
	border-radius: 4px;
	opacity: 0.8;

	&.full {
		background: #ffffff20;
	}

	&.theater {
		background: #7c3aed40;
		color: #c4b5fd;
	}
}

.add-profile-btn {
	display: flex;
	justify-content: center;
	padding-top: 0.25rem;
}
</style>
