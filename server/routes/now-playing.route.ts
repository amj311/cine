import express from 'express';
import { NowPlayingService } from '../services/NowPlayingService';
import { ProfileService } from '../services/ProfileService';

const route = express.Router({ mergeParams: true });

route.get('/', async (req, res) => {
	try {
		const profileId = req.query.profileId as string | undefined;
		if (!profileId) {
			return res.status(400).json({ error: 'profileId query param is required' });
		}
		const profile = await ProfileService.getById(profileId);
		if (!profile) {
			return res.status(404).json({ error: 'Profile not found' });
		}
		if (profile.mode !== 'theater' || !profile.nowPlayingConfig) {
			return res.json({ titles: [], date: '' });
		}
		const { titles, date } = await NowPlayingService.getTodayTitles(profile.nowPlayingConfig);
		res.json({ titles, date });
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;
