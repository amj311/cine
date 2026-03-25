import express from 'express';
import { DirectoryService } from '../services/DirectoryService';
import { VobSubService } from '../services/VobSubService';

const route = express.Router({ mergeParams: true });

/**
 * Extracts VobSub tracks from a video file into dist/assets/vobsub.idx/.sub.
 * Query params:
 *   path       (required) — relative media path
 *   trackIndex (required) — ffprobe stream index of the dvd_subtitle track
 */
route.post('/vobsub/extract', async (req, res) => {
	try {
		const { path, trackIndex } = req.body;
		if (!path || trackIndex === undefined) return res.sendStatus(400);
		const confirmedPath = DirectoryService.resolvePath(path);
		if (!confirmedPath) return res.sendStatus(404);
		await VobSubService.extractVobSub(confirmedPath, parseInt(trackIndex, 10));
		res.sendStatus(200);
	} catch (e: any) {
		console.error(e);
		res.status(500).json({ error: e.message });
	}
});

/**
 * Returns the parsed contents of the VobSub .idx file (dist/assets/vobsub.idx).
 */
route.get('/vobsub/index', async (req, res) => {
	try {
		const idxFile = await VobSubService.getIdxFile();
		if (!idxFile) return res.sendStatus(404);
		res.json(idxFile);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

/**
 * Returns a raw byte chunk from the VobSub .sub file.
 * Query params:
 *   filepos (required) — byte offset into vobsub.sub
 *   size    (optional) — number of bytes to read; omit to read to EOF
 */
route.get('/vobsub/sub', async (req, res) => {
	const filepos = parseInt(req.query.filepos as string, 10);
	const sizeParam = req.query.size as string | undefined;
	const size = sizeParam !== undefined ? parseInt(sizeParam, 10) : undefined;

	if (isNaN(filepos) || filepos < 0) return res.sendStatus(400);
	if (size !== undefined && (isNaN(size) || size <= 0)) return res.sendStatus(400);

	try {
		const chunk = await VobSubService.getSubChunk(filepos, size);
		if (!chunk) return res.sendStatus(404);
		res.set('Content-Type', 'application/octet-stream');
		res.send(chunk);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;
