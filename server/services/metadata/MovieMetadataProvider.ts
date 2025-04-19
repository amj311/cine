import axios from "axios";
import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";
import { IMetadataProvider } from "./IMetadataProvider";
import { LibraryService } from "../LibraryService";
import { TvdbApi } from "./TvdbApi";
import { TmdbApi } from "./TmdbApi";


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
	protected createSearchKeyFromPath(path) {
		// Split the path into file segments, and find one with a (year) in it
		const movieFileName = path.split('/').find(s => s.match(/\(\d{4}\)/));
		const { name, year } = LibraryService.parseNameAndYear(movieFileName);

		return {
			name,
			year: year || '',
		}
	}

	protected async fetchMetadata(key) {
		const api = new TmdbApi();
		const result = await api.getMetadata(key, 'movie', key.details ? ['credits', 'images', 'release_dates'] : []);

		if (key.details) {
			console.log(result.release_dates.results.find((r) => r.iso_3166_1 === 'US'));
			return {
				overview: result.overview,
				poster_full: api.getImageUrl(result.poster_path, 'poster', 'large'),
				background: api.getImageUrl(result.backdrop_path, 'backdrop', 'large'),
				rating: result.vote_average / 2, // out of 5
				votes: result.vote_count,
				genres: result.genres?.map(g => g.name),
				runtime: result.runtime,
				credits: [
					...result.credits?.cast.slice(0, 10).map((c) => ({
						name: c.name,
						role: c.character,
						photo: api.getImageUrl(c.profile_path, 'profile', 'small'),
					})),
					...result.credits?.crew.slice(0, 10).map((c) => ({
						name: c.name,
						role: c.job,
						photo: api.getImageUrl(c.profile_path, 'profile', 'small'),
					})),
				],
				content_rating: result.release_dates?.results.find((r) => r.iso_3166_1 === 'US')?.release_dates[0]?.certification,
			};
		}
		return {
			poster_thumb: api.getImageUrl(result.poster_path, 'poster', 'small'),
			name: result.name,
			year: result.first_aired,
		}
	}
}
