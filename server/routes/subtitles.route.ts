import express from 'express';
import { DirectoryService } from '../services/DirectoryService';
import { VobSubService } from '../services/VobSubService';
import { PgsService } from '../services/PgsService';

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

// ---------------------------------------------------------------------------
// PGS (HDMV Presentation Graphics Stream) routes
// ---------------------------------------------------------------------------

/**
 * Extract a PGS subtitle track from a video file into dist/assets/pgs.sup.
 * Body: { path: string, trackIndex: number }
 */
route.post('/pgs/extract', async (req, res) => {
	try {
		const { path, trackIndex } = req.body;
		if (!path || trackIndex === undefined) return res.sendStatus(400);
		const confirmedPath = DirectoryService.resolvePath(path);
		if (!confirmedPath) return res.sendStatus(404);
		await PgsService.extractPgs(confirmedPath, parseInt(trackIndex, 10));
		res.sendStatus(200);
	} catch (e: any) {
		console.error(e);
		res.status(500).json({ error: e.message });
	}
});

/**
 * Returns the display-set index for the extracted pgs.sup file.
 * Response: PgsEntry[]
 */
route.get('/pgs/index', async (req, res) => {
	try {
		const index = await PgsService.buildIndex();
		if (!index) return res.sendStatus(404);
		res.json(index);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

/**
 * Returns a raw display-set byte range from pgs.sup.
 * Query params:
 *   offset (required) — byte offset into pgs.sup
 *   size   (required) — number of bytes to read
 */
route.get('/pgs/displayset', async (req, res) => {
	const offset = parseInt(req.query.offset as string, 10);
	const size = parseInt(req.query.size as string, 10);

	if (isNaN(offset) || offset < 0) return res.sendStatus(400);
	if (isNaN(size) || size <= 0) return res.sendStatus(400);

	try {
		const chunk = await PgsService.getDisplaySet(offset, size);
		if (!chunk) return res.sendStatus(404);
		res.set('Content-Type', 'application/octet-stream');
		res.send(chunk);
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}
});

export default route;
