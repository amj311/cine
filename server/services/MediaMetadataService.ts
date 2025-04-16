import { MediaMetadataProvider } from "./MediaMetadataProvider";

export type MovieMetadata = {
	key: {
		type: 'movie',
		name: string,
		year: string,
	},
	title: string,
	year: string,
	overview: string,
	poster: string,
	runtime: number,
}

export type SeriesMetadata = {
	key: {
		type: 'series',
		name: string,
		year: string,
	},
	title: string,
	year: string,
	overview: string,
	poster: string,
	runtime: number,
}

export type Metadata =
	MovieMetadata
	| SeriesMetadata
	;

// A string representation of the metadata key
type SerializedMetadataKey = string;
function serializeMetadataKey<T extends Metadata>(key: T['key']): SerializedMetadataKey {
	if (key.type === 'movie') {
		return `type${key.type}name${key.name}year${key.year}`;
	}
	if (key.type === 'series') {
		return `type${key.type}name${key.name}year${key.year}`;
	}
	return JSON.stringify(key);
}

const cache = new Map<SerializedMetadataKey, Metadata>();
const provider = new MediaMetadataProvider();

export class MediaMetadataService {
	/**
	 * Only does a cache lookup, does not fetch from the provider
	 * Useful for returning lists of data from the server and lazy loading the metadata later
	 * @param key 
	 * @returns 
	 */
	public static getCachedMetadata<T extends Metadata>(key: T['key']): T | undefined {
		const serializedKey = serializeMetadataKey(key);
		return cache.get(serializedKey) as T;
	}

	/**
	 * Fetches metadata from the provider and caches it
	 * @param key 
	 * @returns 
	 */
	public static async getMetadata<T extends Metadata>(key: T['key']): Promise<T> {
		const cached = MediaMetadataService.getCachedMetadata(key);
		if (cached) {
			return cached;
		}
		else {
			const metadata = await provider.getMetadata(key) as unknown as T;
			cache.set(serializeMetadataKey(key), metadata);
			return metadata;
		}
	}
}