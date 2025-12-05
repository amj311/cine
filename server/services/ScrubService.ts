import { Store } from "./DataService";
import { AnyPlayable, Playable } from "./LibraryService";

export type ScrubProfile = {
	/**
	 * Properties of media that this scrub applies to
	 */
	target: ScrubTarget,
	scrubs: Array<Scrub>,
}

type ScrubTarget = {
	name: string,
	year?: string,
	seasonNumber?: number,
	episodeNumber?: number,
	version?: string,
}

export type Scrub = {
	/** Seconds, like HTMLMedia CurrentTime */
	start_time_ms: number,
	/** Seconds, like HTMLMedia CurrentTime */
	end_time_ms: number,
	skip?: boolean,
	mute?: boolean,
	overlay?: boolean,
}

const ScrubStore = new Store<'scrubs', ScrubProfile>('scrubs');

export class ScrubService {
	private static norm(val: any) {
		if (val === undefined || val === null) {
			return '<empty>';
		}
		return String(val).replaceAll(/[ _:]/g, '');
	}

	private static createScrubKey(target: ScrubTarget) {
		return `name__${this.norm(target.name)}::year__${this.norm(target.year)}::season__${this.norm(target.seasonNumber)}::episode__${this.norm(target.episodeNumber)}::version__${this.norm(target.version)}`;
	}

	private static createTargetForMedia(media: AnyPlayable): ScrubTarget {
		return {
			name: media.seriesName || media.name, // use seriesName for episodes, or just name for others
			year: media.year || undefined,
			seasonNumber: media.seasonNumber || undefined,
			episodeNumber: media.episodeNumber || undefined,
			version: media.version || undefined,
		};
	}

	private static createKeyFromMedia(media: AnyPlayable): string {
		return this.createScrubKey(this.createTargetForMedia(media));
	}

	public static async createProfileForMedia(media: AnyPlayable) {
		// Don't overwrite existing keys!
		const target = this.createTargetForMedia(media);
		const key = this.createScrubKey(target);
		const existingScrub = await ScrubStore.getByKey(key);
		if (existingScrub) {
			throw new Error(`Scrub with key already exists! ${key}`)
		}
		const newProfile = {
			target,
			scrubs: [],
		}
		await ScrubStore.set(key, newProfile);
		return newProfile;
	}

	public static async updateProfile(profile: ScrubProfile) {
		// Allows updating the key to target a new media!
		const key = this.createScrubKey(profile.target);
		await ScrubStore.set(key, profile);
	}

	public static async getProfileForMedia(media: AnyPlayable) {
		const key = this.createKeyFromMedia(media);
		return await ScrubStore.getByKey(key);
	}
}
