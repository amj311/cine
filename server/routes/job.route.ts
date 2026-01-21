import express from 'express';
import { JobService } from '../services/JobService';
const route = express.Router({ mergeParams: true });

/**
 * Fetches a scrub that matches a particular media file
 */
route.get('/:jobId', async (req, res) => {
	const { jobId } = req.params;

	try {
		const job = JobService.getJob(jobId);

		if (!job) {
			return res.sendStatus(404);
		}

		res.send({
			success: true,
			data: job,
		});
	}
	catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;