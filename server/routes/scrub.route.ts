import express from 'express';
import { LibraryService } from '../services/LibraryService';
import { DirectoryService } from '../services/DirectoryService';
import { ScrubService } from '../services/ScrubService';
const route = express.Router({ mergeParams: true });

/**
 * Fetches a scrub that matches a particular media file
 */
route.get('/media', async (req, res) => {
	const { relativePath } = req.query;

	try {
		const mediaPath = DirectoryService.resolvePath(relativePath as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(relativePath as string)}`);
		}

		const media = await LibraryService.getLibraryForPlayable(mediaPath);

		if (!media.playable) {
			throw new Error(`Could not find playable for path ${relativePath}`);
		}

		res.send({
			success: true,
			data: await ScrubService.getProfileForMedia(media.playable),
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});



/**
 * Creates a scrub that matches a particular media file
 */
route.post('/media', async (req, res) => {
	const { relativePath } = req.query;

	try {
		const mediaPath = DirectoryService.resolvePath(relativePath as string);
		if (!mediaPath) {
			throw new Error(`Must provide valid relativePath. ${decodeURIComponent(relativePath as string)}`);
		}

		const media = await LibraryService.getLibraryForPlayable(mediaPath);

		if (!media.playable) {
			throw new Error(`Could not find playable for path ${relativePath}`);
		}

		res.send({
			success: true,
			data: await ScrubService.createProfileForMedia(media.playable),
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});


/**
 * Update a scrub profile by target
 */
route.put('/', async (req, res) => {
	const profile = req.body;

	try {
		await ScrubService.updateProfile(profile);

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