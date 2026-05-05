import { Store } from './DataService';
import type { NowPlayingConfig } from './NowPlayingService';

export type ProfileMode = 'full' | 'theater';

export type Profile = {
	id: string;
	email: string;
	name: string;
	mode: ProfileMode;
	nowPlayingConfig?: NowPlayingConfig;
};

const profileStore = new Store<Profile>('profiles');

export class ProfileService {
	public static async getProfilesForEmail(email: string): Promise<Profile[]> {
		const all = await profileStore.getValues();
		return all
			.filter((p) => p.email === email)
			.map((p) => p.nowPlayingConfig ? { ...p, nowPlayingConfig: migrateConfig(p.nowPlayingConfig) } : p);
	}

	public static async getById(id: string): Promise<Profile | null> {
		const profile = await profileStore.getByKey(id);
		if (!profile) return null;
		if (profile.nowPlayingConfig) {
			return { ...profile, nowPlayingConfig: migrateConfig(profile.nowPlayingConfig) };
		}
		return profile;
	}

	public static async createProfile(
		email: string,
		name: string,
		mode: ProfileMode,
		nowPlayingConfig?: NowPlayingConfig,
	): Promise<Profile> {
		const id = crypto.randomUUID();
		const profile: Profile = {
			id,
			email,
			name,
			mode,
			...(mode === 'theater' ? { nowPlayingConfig: nowPlayingConfig ?? defaultNowPlayingConfig() } : {}),
		};
		await profileStore.set(id, profile);
		return profile;
	}

	public static async updateProfile(
		id: string,
		email: string,
		patch: Partial<Pick<Profile, 'name' | 'mode' | 'nowPlayingConfig'>>,
	): Promise<Profile> {
		const existing = await profileStore.getByKey(id);
		if (!existing) {
			throw new Error('Profile not found');
		}
		if (existing.email !== email) {
			throw new Error('Forbidden');
		}
		const updated: Profile = { ...existing, ...patch };
		await profileStore.set(id, updated);
		return updated;
	}

	public static async deleteProfile(id: string, email: string): Promise<void> {
		const existing = await profileStore.getByKey(id);
		if (!existing) {
			throw new Error('Profile not found');
		}
		if (existing.email !== email) {
			throw new Error('Forbidden');
		}
		await profileStore.delete(id);
	}
}

function defaultNowPlayingConfig(): NowPlayingConfig {
	return {
		defaultSources: [],
		dayOverrides: {},
	};
}

/**
 * Migrates a stored config that may still be in the old single-source format
 * ({ count, defaultSource, dayOverrides: { [day]: string | null } })
 * to the new multi-source format.
 */
function migrateConfig(raw: any): NowPlayingConfig {
	if (!raw) return defaultNowPlayingConfig();
	// Already new format
	if (Array.isArray(raw.defaultSources)) return raw as NowPlayingConfig;
	// Old format migration
	const oldCount: number = raw.count ?? 4;
	const oldSource: string | null = raw.defaultSource ?? null;
	const oldOverrides: { [day: number]: string | null } = raw.dayOverrides ?? {};
	const newOverrides: { [day: number]: import('./NowPlayingService').NowPlayingSource[] | null } = {};
	for (const [day, src] of Object.entries(oldOverrides)) {
		newOverrides[Number(day)] = src ? [{ directory: src, count: oldCount }] : null;
	}
	return {
		defaultSources: oldSource ? [{ directory: oldSource, count: oldCount }] : [],
		dayOverrides: newOverrides,
	};
}
