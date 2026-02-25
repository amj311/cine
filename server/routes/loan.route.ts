import express from 'express';
import { DirectoryService } from '../services/DirectoryService';
import { Loan, LoanService } from '../services/LoanService';
const route = express.Router({ mergeParams: true });

/**
 */
route.post('/', async (req, res) => {
	const loan = req.body as Loan;

	try {
		const mediaPath = DirectoryService.resolvePath(loan?.relativePath as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(loan?.relativePath as string)}`);
		}

		await LoanService.upsertLoan(loan);

		res.send({
			success: true,
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});


/**
 */
route.delete('/', async (req, res) => {
	const { path } = req.query;

	const mediaPath = DirectoryService.resolvePath(path as string);
	if (!mediaPath) {
		throw new Error(`Must provide valid relativePath. ${decodeURIComponent(path as string)}`);
	}

	try {
		await LoanService.deleteLoan(mediaPath.relativePath);
		res.send({
			success: true,
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;