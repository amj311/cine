import { access } from "fs";
import { Store } from "./DataService";
import { ConfirmedPath, RelativePath } from "./DirectoryService";
import { LibraryService } from "./LibraryService";

/**
 * A cinema title may be loaned to just one email at a time.
 * Only one email is allowed to watch a title at a time
 */

export type Loan = {
	relativePath: string,
	email: string,
	expires: number,
}

const loanStore = new Store<Loan>('loans');

export class LoanService {
	public static async canStreamMedia(playablePath: ConfirmedPath, email: string): Promise<Boolean> {
		// only prevent streaming if this is a media playable
		const playableLibraryItem = await LibraryService.getLibraryForPlayable(playablePath);
		const shouldPrevent = (
			playableLibraryItem.parentLibrary?.type === 'cinema'
			|| playableLibraryItem.parentLibrary?.type === 'album'
			|| playableLibraryItem.parentLibrary?.type === 'audiobook'
		);
		if (!shouldPrevent) {
			return true;
		}

		// if loaned, only the borrower can stream
		// loans are done on parent items, so that needs to have been identified
		if (!playableLibraryItem.parentLibrary) {
			throw new Error("Streamable file must have parent library!");
		}
		const loan = await this.getLoan(playableLibraryItem.parentLibrary.relativePath);
		return loan ? email === loan.email : email === process.env.VITE_OWNER_EMAIL;
	}

	public static async getLoan(path: string) {
		const loan = await loanStore.getByKey(path);
		if (loan && loan.expires > Date.now()) {
			return loan;
		}
		await loanStore.delete(path);
		return null;
	}

	public static async getAllLoans() {
		return await loanStore.getAll();
	}

	public static async upsertLoan(loan: Loan) {
		await loanStore.set(loan.relativePath, loan);
	}

	public static async deleteLoan(path: string) {
		await loanStore.delete(path);
	}

}
