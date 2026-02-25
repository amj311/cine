import { access } from "fs";
import { Store } from "./DataService";
import { ConfirmedPath, RelativePath } from "./DirectoryService";

export type ShareRecord = {
	relativePath: string,
	emails: Array<string>,
}

type AccessType = 'owner' | 'direct' | 'superset' | 'subset' | 'loan';

type SharedAccessWithType = ShareRecord & {
	accessType: AccessType;
}

const shareStore = new Store<ShareRecord>('shares');

export class SharingService {
	public static async isShared(relativePath: string, email: string): Promise<Boolean> {
		return Boolean(await this.determineEmailPathAccess(relativePath, email))
	}

	/**
	 * Evaluates an entire list of paths at once to avoid gathering all shared paths multiple times
	 * Defaults to accept strings but can be given a custom getter for other types
	 * @param args 
	 * @param email 
	 * @returns 
	 */
	public static async getSharedOnly<T = string>(args: Array<T>, email: string, getPath = (arg: T) => String(arg)): Promise<Array<T>> {
		const allShared = await shareStore.getAll();
		const accesses = await Promise.all(args.map(async arg => ({
			...arg,
			access: await this.determineEmailPathAccess(getPath(arg), email, allShared),
		})));
		return accesses.filter(arg => Boolean(arg.access));
	}

	private static async determineEmailPathAccess(relativePath: string, email: string, fromShares?: Array<ShareRecord>): Promise<AccessType | undefined> {
		if (email === process.env.VITE_OWNER_EMAIL) {
			return 'owner';
		}

		// TODO: determine loaned access
		if (!fromShares) {
			fromShares = await shareStore.getAll();
		}

		for (const shared of fromShares) {
			if (!shared?.emails.includes(email)) {
				continue;
			}

			const access = this.determineSharedAccess(relativePath, shared);
			if (access) return access;
		}
	}

	private static determineSharedAccess(relativePath: string, shared: ShareRecord): AccessType | undefined {
		// Direct: This exact path has been shared to them, with access to all children
		if (shared.relativePath === relativePath) {
			return 'direct';
		}

		// Superset: They have access to a parent path, giving access to this as a child
		// IE Shared "Movies/Action/Avengers" can see "Movies/Action" but not "Movies/Action/Thor"
		if (relativePath.startsWith(shared.relativePath)) {
			return 'superset';
		}

		// Subset: They have access to a child path
		// IE Shared "Movies/Action/Avengers" can see "Movies/Action" but not "Movies/Action/Thor"
		if (shared.relativePath.startsWith(relativePath)) {
			return 'subset';
		}
	}

	public static async upsertSharedEmails(path: ConfirmedPath, emails: Array<string>) {
		await shareStore.set(path.relativePath, { relativePath: path.relativePath, emails });
	}

	public static async getAllPathAccess(path: ConfirmedPath): Promise<SharedAccessWithType[]> {
		const allShares = await shareStore.getAll();
		// find all shares with some sort of access to this path
		const sharedAccess = allShares.map(s => ({
			...s,
			accessType: this.determineSharedAccess(path.relativePath, s),
		})).filter(s => Boolean(s.accessType)) as Array<SharedAccessWithType>;

		// todo: include access by loan

		return sharedAccess;
	}

}
