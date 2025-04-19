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

	public async getMetadata(searchParams, type: 'series' | 'movie', appendpoints: string[] = []) {
		const api = await this.getApi();
		const endpoint = type === 'series' ? 'tv' : 'movie';
		const { data } = await api.get('/search/' + endpoint, {
			params: {
				query: searchParams.name,
				primary_release_year: searchParams.year,
			}
		});
		const result = data.results[0];
		if (!result) {
			return null;
		}
		if (appendpoints.length > 0) {
			const details = await this.getDetails(result.id, type, appendpoints);
			return {
				...result,
				...details,
			}
		}
		return result;
	}

	private async getDetails(id: string, type: 'series' | 'movie', appendpoints: string[] = []) {
		const api = await this.getApi();
		const endpoint = type === 'series' ? 'tv' : 'movie';
		const { data } = await api.get('/' + endpoint + '/' + id, {
			params: {
				append_to_response: appendpoints.join(','),
			}
		});
		return data;
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
		small: 'w92',
		large: 'original',
	},
	default: 'original',
};
