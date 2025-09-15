import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";
import { IMetadataProvider } from "./IMetadataProvider";
import { LibraryService } from "../LibraryService";
import { TmdbApi } from "./TmdbApi";
import { ConfirmedPath } from "../DirectoryService";


export type MovieMetadata = MetadataDefinition<
	'movie',
	CommonSearchKey,
	CommonSimpleMetadata,
	CommonDetailsMetadata
>;


/**
 * Responsible for reading metadata about films from a provider API
 */
export class MovieMetadataProvider extends IMetadataProvider<MovieMetadata> {
	protected createSearchKeyFromPath(path: ConfirmedPath) {
		// Split the path into file segments, and find one with a (year) in it
		const movieFileName = path.relativePath.split('/').find(s => s.match(/\(\d{4}\)/))!;
		const { name, year, imdbId } = LibraryService.parseNamePieces(movieFileName);

		return {
			name,
			year: year || '',
			imdbId: imdbId || '',
		}
	}

	protected async fetchMetadata(key) {
		const api = new TmdbApi();
		const result = await api.getMetadataBySearch(key, 'movie');
		if (!result) {
			return null;
		}

		if (key.details) {
			const details = await api.getDetailsById('movie/' + result.id, ['credits', 'images', 'release_dates']);
			return {
				...api.parseCommonData({ ...result, ...details }),
			};
		}
		const common = api.parseCommonData(result);
		return {
			poster_thumb: common.poster_thumb,
		}
	}
}
