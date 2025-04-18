import axios from "axios";
import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";
import { IMetadataProvider } from "./IMetadataProvider";
import { LibraryService } from "../LibraryService";


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
	private authToken: string | null = null;

	private async getApi(skipAuth = false) {
		if (!this.authToken && !skipAuth) {
			await this.authenticate();
		}
		return axios.create({
			baseURL: 'https://api4.thetvdb.com/v4',
			headers: {
				Authorization: this.authToken ? `Bearer ${this.authToken}` : undefined,
			},
		});
	}


	private async authenticate() {
		const api = await this.getApi(true);
		const { data: loginRes } = await api.post('/login', {
			"apikey": "fe254330-557d-4c88-a325-e1e168f16714"
		});
		if (loginRes.status !== 'success') {
			throw new Error('couldnt log in')
		}
		else {
			this.authToken = loginRes.data.token;
		}
	}

	public createSearchKeyFromPath(path) {
		// Split the path into file segments, and find one with a (year) in it
		const movieFileName = path.split('/').find(s => s.match(/\(\d{4}\)/));
		const { name, year } = LibraryService.parseNameAndYear(movieFileName);

		return {
			name,
			year: year || '',
		}
	}

	public async fetchMetadata(key) {
		const api = await this.getApi();
		const { data: searchRes } = await api.get('/search', {
			params: {
				query: key.name,
				year: key.year,
				type: key.type,
				limit: 1,
			}
		});
		const result = searchRes.data[0];
		if (!result) {
			return null;
		}
		return {
			overview: result.overviews?.eng,
			poster: result.image_url,
			poster_thumb: result.image_url,
			name: result.name,
			year: result.first_aired,
		};
	}
}