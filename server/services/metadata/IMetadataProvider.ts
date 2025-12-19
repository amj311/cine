import { ConfirmedPath } from "../DirectoryService";
import { EitherMetadata, MetadataDefinition } from "./MetadataTypes";

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
	 * @param {T['SearchKey']} key
	 * @returns {string}
	 */
	private createCacheKey(key: T['SearchKey']): string {
		// Build an alphabetical string key from the search key to ensure consistency
		const sortedKeys = Object.keys(key).sort();
		return sortedKeys.map(k => `${k}:${key[k as keyof T['SearchKey']]}`).join('|');
	}
	protected addToCache(key: T['SearchKey'], data: EitherMetadata<T['Type']>) {
		const cacheKey = this.createCacheKey(key);
		this.cache.set(cacheKey, data);
	}
	protected getFromCache(key: T['SearchKey']): EitherMetadata<T['Type']> | null {
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
	protected abstract createSearchKeyFromPath(path: ConfirmedPath): T['SearchKey'];

	// Private operations for fetching data
	protected abstract fetchMetadata(key: T['SearchKey']): Promise<EitherMetadata<T['Type']> | null>;


	/***************|
	|	 Public		|
	|***************/
	public async getMetadata(path: ConfirmedPath, details = false, noFetch = false, skipCache = false): Promise<EitherMetadata<T['Type']> | null> {
		const key: T['SearchKey'] = {
			...this.createSearchKeyFromPath(path),
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
