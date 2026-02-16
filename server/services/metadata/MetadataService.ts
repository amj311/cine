import { EitherMetadata, MetadataDefinition, MetadataType } from './MetadataTypes';
import { MovieMetadataProvider } from './MovieMetadataProvider';
import { SeriesMetadataProvider } from './SeriesMetadataProvider';
import { PersonMetadataProvider } from './PersonMetadataProvider';

export type MetadataProviders =
	MovieMetadataProvider
	| SeriesMetadataProvider
	| PersonMetadataProvider
	;

// export type Metadata = EitherMetadata<MovieMetadata>;

const Providers: Record<MetadataType, MetadataProviders> = {
	movie: new MovieMetadataProvider(),
	series: new SeriesMetadataProvider(),
	person: new PersonMetadataProvider(),
};

export class MediaMetadataService {
	/**
	 * Fetches metadata from the provider and caches it
	 * @param key 
	 * @returns 
	 */
	public static async getMetadata<T extends MetadataDefinition>(
		type: T['Type'],
		keySource: T['CacheKeySource'],
		detailed = false,
		noFetch = false,
		skipCache = false,
	): Promise<EitherMetadata<T['Type']> | null> {
		const provider = Providers[type];
		if (!provider) {
			return null;
		}
		return await provider.getMetadataBySearch(keySource, detailed, noFetch, skipCache);
	}
}
