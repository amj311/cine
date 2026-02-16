import { ConfirmedPath } from "../DirectoryService";
import { EitherMetadata, MetadataDefinition, SearchKeyWithDetails } from "./MetadataTypes";

/**
 * Responsible for reading metadata about films from a provider API
 * or generating the data/images from other services if needed
 */
export abstract class IMetadataProvider<T extends MetadataDefinition = MetadataDefinition> {
	/***************|
	|	 Caching	|
	|***************/
	private cache = new Map<string, EitherMetadata<T['Type']>>();

	/**
	 * Turns a search key into a consistent string key for caching
	 * @param {SearchKeyWithDetails<T>} key
	 * @returns {string}
	 */
	private createCacheKey(key: SearchKeyWithDetails<T>): string {
		// Build an alphabetical string key from the search key to ensure consistency
		const sortedKeys = Object.keys(key).sort();
		return sortedKeys.map(k => `${k}:${key[k as keyof SearchKeyWithDetails<T>]}`).join('|');
	}
	protected addToCache(key: SearchKeyWithDetails<T>, data: EitherMetadata<T['Type']>) {
		const cacheKey = this.createCacheKey(key);
		this.cache.set(cacheKey, data);
	}
	protected getFromCache(key: SearchKeyWithDetails<T>): EitherMetadata<T['Type']> | null {
		const cacheKey = this.createCacheKey(key);
		return this.cache.get(cacheKey) || null;
	}

	/***********************|
	|	 Data Fetching		|
	|***********************/

	/**
	 * Determines the unique search key for
	 * @param path 
	 */
	protected abstract createSearchKeyFromSource(path: T['CacheKeySource']): SearchKeyWithDetails<T>;

	// Private operations for fetching data
	protected abstract fetchMetadata(key: SearchKeyWithDetails<T>): Promise<EitherMetadata<T['Type']> | null>;


	/***************|
	|	 Public		|
	|***************/
	public async getMetadataBySearch(path: ConfirmedPath, details = false, noFetch = false, skipCache = false): Promise<EitherMetadata<T['Type']> | null> {
		const key: SearchKeyWithDetails<T> = {
			...this.createSearchKeyFromSource(path),
			details,
		};

		if (!skipCache) {
			const cached = this.getFromCache(key) as T;
			if (cached || noFetch) {
				return cached;
			}
		}

		const metadata = await this.fetchMetadata(key);
		if (!metadata) {
			return null;
		}
		this.addToCache(key, { ...metadata, details });
		return metadata;
	}
}
