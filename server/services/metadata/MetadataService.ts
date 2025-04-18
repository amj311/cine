import { RelativePath } from '../DirectoryService';
import { EitherMetadata, MetadataType } from './MetadataTypes';
import { MovieMetadataProvider } from './MovieMetadataProvider';

export type MetadataProviders =
	MovieMetadataProvider
	;

// export type Metadata = EitherMetadata<MovieMetadata>;

const Providers: Record<MetadataType, MetadataProviders> = {
	movie: new MovieMetadataProvider(),
	series: new MovieMetadataProvider(),
};

export class MediaMetadataService {
	/**
	 * Fetches metadata from the provider and caches it
	 * @param key 
	 * @returns 
	 */
	public static async getMetadata<T extends MetadataType = MetadataType>(
		type: MetadataType,
		path: RelativePath,
		detailed = false,
		noFetch = false
	): Promise<EitherMetadata<T> | null> {
		const provider = Providers[type];
		if (!provider) {
			console.warn('No provider found for type', type);
			return null;
		}
		return await provider.getMetadata(path, detailed, noFetch);
	}
}