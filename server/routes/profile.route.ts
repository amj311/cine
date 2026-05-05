import express from 'express';
import { getSessionEmail } from '../services/SessionService';
import { ProfileService } from '../services/ProfileService';

const route = express.Router({ mergeParams: true });

route.get('/', async (req, res) => {
	try {
		const email = getSessionEmail();
		if (!email) return res.sendStatus(401);
		const profiles = await ProfileService.getProfilesForEmail(email);
		res.json(profiles);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

route.post('/', async (req, res) => {
	try {
		const email = getSessionEmail();
		if (!email) return res.sendStatus(401);
		const { name, mode, nowPlayingConfig } = req.body;
		if (!name || !mode) return res.status(400).json({ error: 'name and mode are required' });
		if (mode !== 'full' && mode !== 'theater') return res.status(400).json({ error: 'mode must be full or theater' });
		const profile = await ProfileService.createProfile(email, name, mode, nowPlayingConfig);
		res.status(201).json(profile);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

route.put('/:id', async (req, res) => {
	try {
		const email = getSessionEmail();
		if (!email) return res.sendStatus(401);
		const { name, mode, nowPlayingConfig } = req.body;
		const profile = await ProfileService.updateProfile(req.params.id, email, { name, mode, nowPlayingConfig });
		res.json(profile);
	} catch (e: any) {
		if (e?.message === 'Profile not found') return res.sendStatus(404);
		if (e?.message === 'Forbidden') return res.sendStatus(403);
		console.error(e);
		res.sendStatus(500);
	}
});

route.delete('/:id', async (req, res) => {
	try {
		const email = getSessionEmail();
		if (!email) return res.sendStatus(401);
		await ProfileService.deleteProfile(req.params.id, email);
		res.sendStatus(204);
	} catch (e: any) {
		if (e?.message === 'Profile not found') return res.sendStatus(404);
		if (e?.message === 'Forbidden') return res.sendStatus(403);
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;
