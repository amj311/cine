import dotenv from 'dotenv';
dotenv.config();

import bodyParser from 'body-parser';
const { json, urlencoded } = bodyParser as any;
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import express from 'express';
const app = express() as any;

import cors from 'cors';
import fs, { readdirSync } from 'fs';
import { DirectoryService } from './services/DirectoryService';
import { LibraryService } from './services/LibraryService';
import { MediaMetadataService } from './services/metadata/MetadataService';
import { WatchProgress, WatchProgressService } from './services/WatchProgressService';
import mime from 'mime-types';
import { EitherMetadata } from './services/metadata/MetadataTypes';

const corsOptions = {};

app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));


// get directory at relative path from media dir
app.get("/api/dir/", async function (req, res) {
	let { dir } = req.query;
	if (!dir) {
		res.status(400).send("Requires dir query param");
		return;
	}
	if (dir === "/") {
		dir = "";
	}
	try {
		const { folders, files } = await DirectoryService.listDirectory(dir as string);
		const libraryItem = await LibraryService.parseFolderToItem(dir as string, true);

		return res.json({
			libraryItem,
			directory: {
				files,
				folders: (await Promise.all(folders.map(async (folder) => {
					const libraryItem = await LibraryService.parseFolderToItem(path.join(dir as string, folder), true);
					return {
						folderName: folder,
						libraryItem,
					};
				}))).sort((a, b) => a.libraryItem?.sortKey.localeCompare(b.libraryItem?.sortKey || '') || 0),
			},
		});
	}
	catch (err) {
		console.error(err);
		res.status(500).send("Error reading directory");
	}
});

app.get("/api/video", function (req, res) {
	const range = req.headers.range;
	if (!range) {
		res.status(400).send("Requires Range header");
	}
	let { src } = req.query;
	if (!src) {
		res.status(400).send("Requires src query param");
		return;
	}
	src = src.replaceAll('<amp>', '&');
	const file = DirectoryService.resolvePath(src as string);
	fs.stat(file, function (err, stats) {
		if (err) {
			console.error(`Failed to load video file: "${file}"`)
			console.error(err)
			if (err.code === 'ENOENT') {
				// 404 Error if file not found
				return res.sendStatus(404);
			}
			res.end(err);
		}

		const range = req.headers.range;
		if (!range) {
			// 416 Wrong range
			console.error("No range!")
			return res.sendStatus(416);
		}

		const positions = range.replace(/bytes=/, "").split("-");
		const start = parseInt(positions[0], 10);
		const total = stats.size;
		const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
		const chunksize = (end - start) + 1;

		// console.log({
		// 	src,
		// 	range,
		// 	positions,
		// 	start,
		// 	end,
		// });

		// Dynamically determine the MIME type
		const mimeType = mime.lookup(file) || 'application/octet-stream';

		res.writeHead(206, {
			"Content-Range": "bytes " + start + "-" + end + "/" + total,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": mimeType
		});

		const stream = fs.createReadStream(file, { start: start, end: end })
			.on("open", function () {
				stream.pipe(res);
			}).on("error", function (err) {
				console.error("Error reading stream!", err)
				res.end(err);
			});
	});
});

app.post('/api/metadata', async (req, res) => {
	try {
		const { type, path, detailed } = req.body;
		if (!path) {
			res.json({
				error: 'No path provided',
				success: false,
				data: null,
			});
			return;
		}
		let mediaType = type;
		if (!mediaType) {
			mediaType = LibraryService.determineMediaTypeFromPath(path);
		}
		const metadata = await MediaMetadataService.getMetadata(mediaType, path, detailed);
		res.json({
			data: metadata,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});



app.get('/api/watchProgress', async (req, res) => {
	try {
		const { relativePath } = req.query;
		const progress = await WatchProgressService.getWatchProgress(relativePath);
		res.json({
			data: progress,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});
app.post('/api/watchProgress', async (req, res) => {
	try {
		const { relativePath, progress } = req.body;
		await WatchProgressService.updateWatchProgress(relativePath, progress);
		res.json({
			success: true,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});






app.get('/api/theaterData', async (req, res) => {
	try {
		const { relativePath } = req.query;
		const data = await LibraryService.getLibraryForPlayable(relativePath);
		res.json({
			data,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});




app.get('/api/feed', async (req, res) => {
	try {
		const feedLists = [] as Array<{
			title: string;
			type: string;
			items: Array<{
				title?: string;
				subtitle?: string;
				relativePath: string;
				metadata?: EitherMetadata;
				watchProgress?: WatchProgress;
				libraryItem?: any;
				isUpNext?: boolean;
			}>;
		}>;

		const watchItems = await WatchProgressService.getContinueWatchingList();
		const lastFinishedEpisode = await WatchProgressService.getLastFinishedEpisode();
		let nextEpisode: any = null;
		if (lastFinishedEpisode) {
			nextEpisode = await LibraryService.getNextEpisode(lastFinishedEpisode.relativePath);
		}
		if (nextEpisode) {
			watchItems.push({ ...nextEpisode, isUpNext: true });
		}
		if (watchItems.length > 0) {
			feedLists.push({
				title: "Continue Watching",
				type: "continue-watching",
				items: await Promise.all(watchItems.map(async (item) => ({
					title: LibraryService.parseNamePieces(item.relativePath).name,
					relativePath: item.relativePath,
					watchProgress: item,
					metadata: MediaMetadataService.getMetadata(
						LibraryService.determineMediaTypeFromPath(item.relativePath) as any,
						item.relativePath,
					),
					libraryItem: await LibraryService.getLibraryForPlayable(item.relativePath),
					isUpNext: item.isUpNext,
				}))),
			});
		}

		res.json({
			success: true,
			data: feedLists,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}

});





// STATIC SITE
app.use('/assets', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/assets/' + req.path));
});
app.use('/public', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/public/' + req.path));
});
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/index.html'));
});


const port = process.env.PORT || 5000;
app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});
