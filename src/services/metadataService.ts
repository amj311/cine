import api from "./api";

export class MetadataService {
	static async getMetadata(media) {
		if (media.metadata) {
			return media.metadata;
		}

		try {
			const key = MetadataService.getMediaKey(media);
			if (!key) {
				return null;
			}
			const { data } = await api.post("/metadata", key);
			return data.data;
		}
		catch (err) {
			console.error(err);
			return null;
		}
	}

	static getMediaKey(media) {
		if (media.type === "movie") {
			return {
				type: "movie",
				year: media.year,
				name: media.name,
			};
		}
		if (media.type === "series") {
			return {
				type: "series",
				year: media.year,
				name: media.name,
			};
		}
	}

}