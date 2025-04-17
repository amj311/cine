import axios from "axios";
import { Metadata } from "./MediaMetadataService";

/**
 * Responsible for reading metadata about films from a provider API
 */
export class MediaMetadataProvider {
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

		console.log(loginRes)

		if (loginRes.status !== 'success') {
			throw new Error('couldnt log in')
		}
		else {
			this.authToken = loginRes.data.token;
		}
	}


	public async getMetadata<T extends Metadata>(key: T['key']): Promise<T | null> {
		const api = await this.getApi();
		// const name = "Concussion (2015)" + '.mp4';
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
		} as T;
	}
}