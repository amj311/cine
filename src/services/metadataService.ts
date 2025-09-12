import { useApiStore } from "@/stores/api.store";


export class MetadataService {
	static async getMetadata(media, detailed = false) {
		if (media.metadata && media.metadata.details === detailed) {
			return media.metadata;
		}

		try {
			const api = useApiStore().api;
			const { data } = await api.post("/metadata", {
				type: media.cinemaType,
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