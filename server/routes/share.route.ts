import express from 'express';
import { LibraryService } from '../services/LibraryService';
import { DirectoryService } from '../services/DirectoryService';
import { SurpriseService } from '../services/SurpriseService';
import { SharingService } from '../services/SharingService';
const route = express.Router({ mergeParams: true });

/**
 */
route.get('/', async (req, res) => {
	const { path } = req.query;

	try {
		const mediaPath = DirectoryService.resolvePath(path as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(path as string)}`);
		}

		const data = await SharingService.getAllPathAccess(mediaPath);

		res.send({
			success: true,
			data,
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});


/**
 */
route.post('/', async (req, res) => {
	const { path, emails } = req.body;

	try {
		const mediaPath = DirectoryService.resolvePath(path as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(path as string)}`);
		}

		for (const email of emails) {
			if (typeof email !== 'string') {
				throw new Error('Incorrect type for emails');
			}
		}

		await SharingService.upsertSharedEmails(mediaPath, emails);

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