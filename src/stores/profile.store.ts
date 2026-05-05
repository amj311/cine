import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useApiStore } from './api.store';

export type ProfileMode = 'full' | 'theater';

export type NowPlayingTitleFilter = 'movie' | 'series' | null;

export type NowPlayingSource = {
	directory: string;
	count: number;
	filter?: NowPlayingTitleFilter;
};

export type NowPlayingConfig = {
	defaultSources: NowPlayingSource[];
	dayOverrides: { [day: number]: NowPlayingSource[] | null };
};

export type Profile = {
	id: string;
	email: string;
	name: string;
	mode: ProfileMode;
	nowPlayingConfig?: NowPlayingConfig;
};

function localStorageKey(email: string) {
	return `_op_profile_${email}`;
}

export const useProfileStore = defineStore('profile', () => {
	const profiles = ref<Profile[]>([]);
	const activeProfileId = ref<string | null>(null);
	const _email = ref<string | null>(null);

	const activeProfile = computed<Profile | null>(() =>
		activeProfileId.value ? (profiles.value.find((p) => p.id === activeProfileId.value) ?? null) : null,
	);

	const isDefaultProfile = computed(() => activeProfileId.value === null);

	const isTheaterMode = computed(() => activeProfile.value?.mode === 'theater');

	async function loadProfiles(email: string) {
		_email.value = email;
		try {
			const { data } = await useApiStore().api.get('/profiles');
			profiles.value = data;
		} catch (e) {
			console.error('Failed to load profiles', e);
			profiles.value = [];
		}

		// Restore active profile from localStorage
		const stored = localStorage.getItem(localStorageKey(email));
		if (stored && profiles.value.some((p) => p.id === stored)) {
			activeProfileId.value = stored;
		} else {
			activeProfileId.value = null;
		}
	}

	function reset() {
		profiles.value = [];
		activeProfileId.value = null;
		_email.value = null;
	}

	function setActiveProfile(id: string | null) {
		activeProfileId.value = id;
		if (_email.value) {
			if (id === null) {
				localStorage.removeItem(localStorageKey(_email.value));
			} else {
				localStorage.setItem(localStorageKey(_email.value), id);
			}
		}
	}

	async function createProfile(name: string, mode: ProfileMode, nowPlayingConfig?: NowPlayingConfig): Promise<Profile> {
		const { data } = await useApiStore().api.post('/profiles', { name, mode, nowPlayingConfig });
		profiles.value = [...profiles.value, data];
		return data;
	}

	async function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'mode' | 'nowPlayingConfig'>>): Promise<Profile> {
		const { data } = await useApiStore().api.put(`/profiles/${id}`, patch);
		profiles.value = profiles.value.map((p) => (p.id === id ? data : p));
		return data;
	}

	async function deleteProfile(id: string): Promise<void> {
		await useApiStore().api.delete(`/profiles/${id}`);
		profiles.value = profiles.value.filter((p) => p.id !== id);
		if (activeProfileId.value === id) {
			setActiveProfile(null);
		}
	}

	return {
		profiles,
		activeProfileId,
		activeProfile,
		isDefaultProfile,
		isTheaterMode,
		loadProfiles,
		reset,
		setActiveProfile,
		createProfile,
		updateProfile,
		deleteProfile,
	};
});
