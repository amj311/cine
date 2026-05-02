import express from 'express';
import { isOwner } from '../services/SessionService';
import { NowPlayingService } from '../services/NowPlayingService';

const route = express.Router({ mergeParams: true });

route.get('/', async (req, res) => {
	try {
		const { titles, date } = await NowPlayingService.getTodayTitles();
		res.json({ titles, date });
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

route.get('/config', async (req, res) => {
	if (!isOwner()) {
		return res.sendStatus(403);
	}
	try {
		const config = await NowPlayingService.getConfig();
		res.json(config);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

route.put('/config', async (req, res) => {
	if (!isOwner()) {
		return res.sendStatus(403);
	}
	try {
		const { count, defaultSource, dayOverrides } = req.body;
		await NowPlayingService.saveConfig({ count, defaultSource, dayOverrides });
		res.json({ success: true });
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;
