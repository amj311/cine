import express from 'express';
import { LibraryService } from '../services/LibraryService';
import { DirectoryService } from '../services/DirectoryService';
import { SurpriseService } from '../services/SurpriseService';
const route = express.Router({ mergeParams: true });

/**
 * Creates a scrub that matches a particular media file
 */
route.post('/', async (req, res) => {
	const { path, record } = req.body;

	try {
		const mediaPath = DirectoryService.resolvePath(path as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(path as string)}`);
		}

		if (record) {
			await SurpriseService.updateSurprise(mediaPath, record);
		}
		else {
			await SurpriseService.deleteSurprise(mediaPath);
		}

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