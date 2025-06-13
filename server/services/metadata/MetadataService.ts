import { ConfirmedPath } from '../DirectoryService';
import { EitherMetadata, MetadataType } from './MetadataTypes';
import { MovieMetadataProvider } from './MovieMetadataProvider';
import { SeriesMetadataProvider } from './SeriesMetadataProvider';

export type MetadataProviders =
	MovieMetadataProvider
	| SeriesMetadataProvider
	;

// export type Metadata = EitherMetadata<MovieMetadata>;

const Providers: Record<MetadataType, MetadataProviders> = {
	movie: new MovieMetadataProvider(),
	series: new SeriesMetadataProvider(),
};

export class MediaMetadataService {
	/**
	 * Fetches metadata from the provider and caches it
	 * @param key 
	 * @returns 
	 */
	public static async getMetadata<T extends MetadataType = MetadataType>(
		type: MetadataType,
		path: ConfirmedPath,
		detailed = false,
		noFetch = false
	): Promise<EitherMetadata<T> | null> {
		const provider = Providers[type];
		if (!provider) {
			return null;
		}
		return await provider.getMetadata(path, detailed, noFetch);
	}
}