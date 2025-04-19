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
export class TvdbApi {
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
			"apikey": process.env.TVDB_API_KEY,
		});
		if (loginRes.status !== 'success') {
			throw new Error('couldnt log in')
		}
		else {
			this.authToken = loginRes.data.token;
		}
	}

	public async getMetadata(searchParams, type: 'series' | 'movie') {
		const api = await this.getApi();
		const { data: searchRes } = await api.get('/search', {
			params: {
				query: searchParams.name,
				year: searchParams.year,
				type,
				limit: 1,
			}
		});
		const result = searchRes.data[0];
		if (!result) {
			return null;
		}
		return {
			overview: result.overviews?.eng,
			poster_thumb: result.image_url,
			name: result.name,
			year: result.first_aired,
		};
	}
}
