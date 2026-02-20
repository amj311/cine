import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";
import { IMetadataProvider } from "./IMetadataProvider";
import { LibraryService } from "../LibraryService";
import { TmdbApi } from "./TmdbApi";
import { ConfirmedPath } from "../DirectoryService";


export type SeriesMetadata = MetadataDefinition<
	'series',
	ConfirmedPath,
	CommonSearchKey,
	CommonSimpleMetadata,
	CommonDetailsMetadata
>;


/**
 * Responsible for reading metadata about films from a provider API
 */
export class SeriesMetadataProvider extends IMetadataProvider<SeriesMetadata> {
	protected createSearchKeyFromSource(path: ConfirmedPath) {
		// Split the path into file segments, and find one with a (year) in it
		const seriesFileName = path.relativePath.split('/').find(s => s.match(/\(\d{4}\)/))!;
		const { name, year, imdbId } = LibraryService.parseNamePieces(seriesFileName);

		return {
			name,
			year: year || '',
			imdbId: imdbId || '',
		}
	}

	// TODO override get from cache to look up episode data from season data


	protected async fetchMetadata(key: CommonSearchKey) {
		const api = new TmdbApi();
		const result = await api.getMetadataBySearch(key, 'tv');
		if (!result) {
			return null;
		}

		if (key.details) {
			const details = await api.getDetailsById('tv/' + result.id, ['credits', 'images', 'content_ratings', 'eipsode_groups']);

			const seasons = await Promise.all(details.seasons.map(async (s: any) => {
				const seasonDetails = await api.getDetailsById(`tv/${result.id}/season/${s.season_number}`, ['images']);
				return {
					seasonNumber: s.season_number,
					name: s.name,
					...api.parseCommonData(seasonDetails),

					episodes: seasonDetails.episodes.map((e: any) => ({
						name: e.name,
						overview: e.overview,
						seasonNumber: s.season_number,
						episodeNumber: e.episode_number,
						air_date: e.air_date,
						runtime: e.runtime,
						still_thumb: api.getImageUrl(e.still_path, 'still', 'small'),
						still_full: api.getImageUrl(e.still_path, 'still', 'large'),
						credits: api.extractCredits(e), // crew and guest_stars
					})),
				}
			}));


			return {
				...api.parseCommonData({ ...result, ...details }),
				seasons,
			};
		}
		const common = api.parseCommonData(result);
		return {
			poster_thumb: common.poster_thumb,
		}
	}
}
