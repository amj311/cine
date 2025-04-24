import api from "./api";

export class MetadataService {
	static async getMetadata(media, detailed = false) {
		if (media.metadata && media.metadata.details === detailed) {
			return media.metadata;
		}

		try {
			const { data } = await api.post("/metadata", {
				type: media.type,
				path: media.relativePath,
				detailed,
			});
			return data.data;
		}
		catch (err) {
			console.error(err);
			return null;
		}
	}
}