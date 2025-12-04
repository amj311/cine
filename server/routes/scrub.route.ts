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

	const mediaPath = DirectoryService.resolvePath(relativePath as string);
	if (!mediaPath) {
		throw new Error("Must provide valid relativePath");
	}

	const media = await LibraryService.getLibraryForPlayable(mediaPath);

	if (!media.playable) {
		throw new Error(`Could not find playable for path ${relativePath}`);
	}

	res.send({
		success: true,
		data: await ScrubService.getProfileForMedia(media.playable),
	});
});



/**
 * Creates a scrub that matches a particular media file
 */
route.post('/media', async (req, res) => {
	const { relativePath } = req.query;

	const mediaPath = DirectoryService.resolvePath(relativePath as string);
	if (!mediaPath) {
		throw new Error("Must provide valid relativePath");
	}

	const media = await LibraryService.getLibraryForPlayable(mediaPath);

	if (!media.playable) {
		throw new Error(`Could not find playable for path ${relativePath}`);
	}

	res.send({
		success: true,
		data: await ScrubService.createProfileForMedia(media.playable),
	});
});


/**
 * Update a scrub profile by target
 */
route.put('/', async (req, res) => {
	const profile = req.body;

	await ScrubService.updateProfile(profile);

	res.send({
		success: true,
	});
});

export default route;