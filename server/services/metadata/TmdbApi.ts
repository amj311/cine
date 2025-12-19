import axios from "axios";
import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";

export type MovieMetadata = MetadataDefinition<
	'movie',
	CommonSearchKey,
	CommonSimpleMetadata,
	CommonDetailsMetadata
>;


/**
 * Responsible for reading metadata about films from a provider API
 */
export class TmdbApi {
	private async getApi() {
		return axios.create({
			baseURL: 'https://api.themoviedb.org/3/',
			headers: {
				Authorization: 'Bearer ' + process.env.TMDB_ACCESS_TOKEN,
			},
		});
	}

	public async getMetadataBySearch(searchParams, entity: 'tv' | 'movie') {
		const api = await this.getApi();
		const { data } = await api.get('/search/' + entity, {
			params: {
				query: searchParams.name,
				year: searchParams.year,

			}
		});
		// Can't do simple search by imdb, so we have to look deeper to be that specific
		// lok at just the first two results. Less likely that THREE are in conflict.
		if (searchParams.imdbId) {
			const details = await Promise.all(
				data.results.slice(0, 2).map(r => this.getDetailsById(entity + '/' + r.id))
			);
			const match = details.find(d => d.imdb_id === searchParams.imdbId);
			if (match) {
				return match;
			}
		}

		const result = data.results[0];
		return result || null;
	}

	public async getDetailsById(path: string, appendpoints: string[] = []) {
		const api = await this.getApi();
		const { data } = await api.get(path, {
			params: {
				append_to_response: appendpoints.join(','),
			}
		});
		return data;
	}

	public parseCommonData(result: any) {
		return {
			overview: result.overview,
			poster_thumb: this.getImageUrl(result.poster_path, 'poster', 'small'),
			poster_full: this.getImageUrl(result.poster_path, 'poster', 'large'),
			background: this.getImageUrl(result.backdrop_path, 'backdrop', 'large'),
			background_thumb: this.getImageUrl(result.backdrop_path, 'backdrop', 'small'),
			logo: this.getImageUrl(
				result.images?.logos?.find(i => i.iso_639_1 === 'en')?.file_path,
				'logo',
				'large',
			),
			rating: result.vote_average / 2, // out of 5
			votes: result.vote_count,
			genres: result.genres?.map(g => g.name),
			runtime: result.runtime,
			credits: [
				...(result.credits?.cast.slice(0, 20).map((c) => ({
					name: c.name,
					role: c.character,
					photo: this.getImageUrl(c.profile_path, 'profile', 'small'),
				})) || []),
				...(result.credits?.crew.slice(0, 20).map((c) => ({
					name: c.name,
					role: c.job,
					photo: this.getImageUrl(c.profile_path, 'profile', 'small'),
				})) || []),
			],
			content_rating:
				result.release_dates?.results.find((r) => r.iso_3166_1 === 'US')?.release_dates[0]?.certification
				|| result.content_ratings?.results.find((r) => r.iso_3166_1 === 'US')?.rating,
		}
	}

	// IMAGE URLS
	public getImageUrl(path: string, type: ImageType, size: ImageSize) {
		if (!path) {
			return '';
		}
		const sizeString = ImageSizes[type][size] || ImageSizes['default'];
		return `https://image.tmdb.org/t/p/${sizeString}${path}`;
	}
}


const ImageTypes = ['poster', 'backdrop', 'logo', 'profile', 'still'] as const;
type ImageType = typeof ImageTypes[number];
type ImageSize = 'small' | 'large' | 'default';

// https://www.themoviedb.org/talk/53c11d4ec3a3684cf4006400
const ImageSizes = {
	poster: {
		small: 'w342',
		large: 'w500',
	},
	backdrop: {
		small: 'w300',
		large: 'w1280',
	},
	logo: {
		small: 'w92',
		large: 'w300',
	},
	profile: {
		small: 'w185',
	},
	still: {
		small: 'w300',
		large: 'original',
	},
	default: 'original',
};
