/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { Store } from "./DataService";
import { ConfirmedPath, RelativePath } from "./DirectoryService";

export type SurpriseRecord = {
	relativePath: string,
	pin: string, // allows bypassing surprise cover
	until: string,
}

const surprisesStore = new Store<SurpriseRecord>('surprises');

export class SurpriseService {
	public static async updateSurprise(path: ConfirmedPath, record: SurpriseRecord) {
		await surprisesStore.set(path.relativePath, { ...record, relativePath: path.relativePath });
	}

	public static async getSurprise(path: ConfirmedPath): Promise<SurpriseRecord | null> {
		return await surprisesStore.getByKey(path.relativePath);
	}

	public static async deleteSurprise(path: ConfirmedPath) {
		await surprisesStore.delete(path.relativePath);
	}
}
