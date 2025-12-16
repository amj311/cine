/**
 * Keeps track of the media that are being watched and not yet finished
 */

import { ConfirmedPath, RelativePath } from "./DirectoryService";

export type SurpriseRecord = {
	relativePath: string,
	pin: string, // allows bypassing surprise cover
	until: string,
}

const surprises = new Map<RelativePath, SurpriseRecord>();

export class SurpriseService {
	public static updateSurprise(path: ConfirmedPath, record: SurpriseRecord): void {
		surprises.set(path.relativePath, { ...record, relativePath: path.relativePath });
	}

	public static getSurprise(path: ConfirmedPath): SurpriseRecord | undefined {
		return surprises.get(path.relativePath);
	}

	public static deleteSurprise(path: ConfirmedPath): void {
		surprises.delete(path.relativePath);
	}
}
