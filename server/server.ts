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
import { LibraryService, Photo } from './services/LibraryService';
import { MediaMetadataService } from './services/metadata/MetadataService';
import { WatchProgress, WatchProgressService } from './services/WatchProgressService';
import mime from 'mime-types';
import { EitherMetadata } from './services/metadata/MetadataTypes';
import { ThumbnailService } from './services/ThumbnailService';
import ffmpeg from 'fluent-ffmpeg';
import { ProbeService } from './services/ProbeService';
import tesseract from 'tesseract.js';

const corsOptions = {};

app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));

app.get('/health', (_, res) => res.sendStatus(200));

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

app.get("/api/stream", async function (req, res) {
	let { src } = req.query;
	if (!src) {
		res.status(400).send("Requires src query param");
		return;
	}
	src = src.replaceAll('<amp>', '&');
	const file = DirectoryService.resolvePath(src as string);

	if (file.endsWith('.3gp')) {
		const outputFilePath = path.join(__dirname, '../dist/assets/conversion.mp4');
		await new Promise<void>((resolve, reject) => {
			// Convert 3GP to MP4
			ffmpeg(file)
				.output(outputFilePath)
				.videoCodec('copy') // Copy the video stream without re-encoding
				.audioCodec('aac')  // Encode the audio stream in AAC
				.on('end', () => {
					resolve();
				})
				.on('error', (err) => {
					console.error('Error during conversion: ', err.message);
				})
				.run();
		});
		res.sendFile(outputFilePath, (err) => {
			if (err) {
				console.error("Error while sending converted file:", err);
				res.status(500).send("Error sending converted file");
			}
		});
		return;
	}

	const stramable = ['mp4', 'mp3'];
	if (!stramable.some((ext) => file.endsWith(ext))) {
		res.status(400).send("File type not supported for streaming");
		return;
	}

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

app.post('/api/prepareAudio', async (req, res) => {
	const { src, index } = req.body;
	// Use ffmpeg to extract indicated audio stream from video file as mp3
	if (!src) {
		res.status(400).send("Requires src query param");
		return;
	}
	if (!index) {
		res.status(400).send("Requires index query param");
		return;
	}
	const file = DirectoryService.resolvePath(src as string);
	const outputFilePath = path.join(__dirname, '../dist/assets/conversion.mp3');
	await new Promise<void>((resolve, reject) => {
		ffmpeg(file)
			.outputOptions(`-map 0:${index}`)
			.outputOptions('-c:a libmp3lame')
			.output(outputFilePath)
			.on('end', () => {
				resolve();
			})
			.on('error', (err) => {
				reject(err);
			})
			.run();
	}).catch((err) => {
		console.error("Error while sending converted file:", err);
		res.status(500).send("Error sending converted file");
	});
	res.send(200);
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
		const { relativePath, progress, bookmarkId } = req.body;
		await WatchProgressService.updateWatchProgress(relativePath, progress, bookmarkId);
		res.json({
			success: true,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});
app.delete('/api/watchProgress/bookmark', async (req, res) => {
	try {
		const { relativePath, bookmarkId } = req.body;
		await WatchProgressService.deleteBookmark(relativePath, bookmarkId);
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
		const libraryData = await LibraryService.getLibraryForPlayable(relativePath);
		const probe = await ProbeService.getProbeData(relativePath);
		res.json({
			data: {
				playable: libraryData.playable,
				parentLibrary: libraryData.parentLibrary,
				probe: probe.glossary,
			},
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

		// Continue Watching
		const watchItems = await WatchProgressService.getContinueWatchingList();
		const lastFinishedEpisode = await WatchProgressService.getLastFinishedEpisode();
		let nextEpisode: any = null;
		if (lastFinishedEpisode) {
			nextEpisode = await LibraryService.getNextEpisode(lastFinishedEpisode.relativePath);
		}
		if (nextEpisode) {
			watchItems.unshift({ ...nextEpisode, isUpNext: true });
		}
		if (watchItems.length > 0) {
			feedLists.push({
				title: "Continue Watching",
				type: "continue-watching",
				items: await Promise.all(watchItems.map(async (item: any) => ({
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

		// identify photo libraries
		const libraries = await LibraryService.getRootLibraries();
		const photoLibraries = libraries.filter((library) => library.libraryType === 'photos');
		const allPhotos = (await Promise.all(photoLibraries.map(async (library) => {
			const { files } = await LibraryService.getFlatTree(library.name);
			return files;
		}))).flat().sort((a, b) => {
			if (!a.takenAt) {
				return 1;
			}
			if (!b.takenAt) {
				return -1;
			}
			return new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime();
		});

		// Recent Photos
		const recentPhotos = allPhotos.slice(0, 10) as Array<Photo>;
		if (recentPhotos.length > 0) {
			feedLists.push({
				title: "Recent Photos",
				type: "photos",
				items: recentPhotos,
			});
		}

		// Past Photos
		// Find past photos that match today's date +- day range
		const dayRange = 3;
		const today = new Date();
		const pastPhotos = allPhotos.filter((photo) => {
			if (!photo.takenAt) {
				return false;
			}
			const photoDate = new Date(photo.takenAt);
			// set photo date to same year as today
			photoDate.setFullYear(today.getFullYear());
			const diffTime = Math.abs(photoDate.getTime() - today.getTime());
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			return diffDays <= dayRange;
		});

		if (pastPhotos.length > 0) {
			feedLists.push({
				title: "Memories",
				type: "photos",
				items: pastPhotos,
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



app.get('/api/rootLibraries', async (req, res) => {
	try {
		const libraries = await LibraryService.getRootLibraries();
		res.json({
			success: true,
			data: libraries,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});

app.get('/api/rootLibrary/:name/flat', async (req, res) => {
	try {
		const { name } = req.params;
		const items = await LibraryService.getFlatTree(name);
		res.json({
			success: true,
			data: items,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});



app.get('/api/subtitles', async (req, res) => {
	try {
		const { path: relativePath, index } = req.query;
		const fullPath = DirectoryService.resolvePath(relativePath as string);
		const probe = await ProbeService.getProbeData(fullPath);

		const subtitleStream = probe.full.streams[index];

		if (subtitleStream && subtitleStream.codec_type === 'subtitle') {
			if (subtitleStream.codec_name === 'mov_text') {
				const subtitleIndex = subtitleStream.index;
				const outputFilePath = path.join(__dirname, '../dist/assets/output.vtt');
				ffmpeg(DirectoryService.resolvePath(relativePath))
					.outputOptions(`-map 0:${subtitleIndex}`)
					.outputOptions('-c:s webvtt')
					.save(outputFilePath)
					.on('end', () => {
						// set cors header
						res.setHeader('Access-Control-Allow-Origin', '*');
						res.setHeader('Content-Type', 'text/vtt');
						res.sendFile(outputFilePath, (err) => {
							if (err) {
								console.error("Error while sending subtitle file:", err);
								res.status(500).send("Error sending subtitle file");
							}
						});
					})
					.on('error', (err) => {
						console.error("Error while extracting subtitles:", err);
						res.status(500).send("Error extracting subtitles");
					});
			}
			else if (subtitleStream.codec_name === 'dvd_subtitle') {
				// extract to .idx and .sub, then recognize with tesseract
				const subtitleIndex = subtitleStream.index;
				const outFile = path.join(__dirname, '../dist/assets/temp.sup');

				// Extract VobSub subtitles
				ffmpeg(fullPath)
					.outputOptions(`-map 0:${subtitleIndex}`)
					.outputOptions('-c:s copy') // Copy the subtitle stream without re-encoding
					.output(outFile) // Output the .idx file
					.on('end', async () => {
						try {
							console.log("VobSub subtitles extracted successfully");
							// Perform OCR on the extracted subtitles
							// const ocrResult = await tesseract.recognize(subFilePath, 'eng');

							// console.log("OCR Result:", ocrResult.data.text);

							// Send the OCR result as plain text
							res.setHeader('Access-Control-Allow-Origin', '*');
							res.setHeader('Content-Type', 'text/plain');
							// res.send(ocrResult.data.text);
							res.send(200);
						} catch (ocrError) {
							console.error("Error during OCR processing:", ocrError);
							res.status(500).send("Error during OCR processing");
						}
					})
					.on('error', (ffmpegError) => {
						console.error("Error while extracting VobSub subtitles:", ffmpegError);
						res.status(500).send("Error extracting VobSub subtitles");
					})
					.run();
			}
			else {
				res.status(400).send("Unsupported subtitle format: " + subtitleStream.codec_name);
			}
		}
		else {
			console.log("No subtitle stream found");
			res.status(404).send("No subtitle stream found");
		}
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
app.use('/api/assets', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/assets/' + req.path));
});
app.use('/public', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/public/' + req.path));
});
app.use('/serviceworker.js', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/public/serviceworker.js'));
});
app.use('/api/media', (req, res) => {
	const relativePath = req.path;
	res.sendFile(DirectoryService.resolvePath(relativePath));
});
app.use('/api/thumb', (req, res) => {
	const relativePath = req.path;
	const { width } = req.query;
	(async () => {
		// Gifs don't work if sharp resizes them, so just send he og file.
		// Consider using gif-encode in the future if gifs are too large and still need to be resized.
		if (relativePath.endsWith('.gif')) {
			res.sendFile(DirectoryService.resolvePath(relativePath));
			return;
		}
		try {
			const thumbnailBuffer = await ThumbnailService.streamThumbnail(relativePath, !isNaN(width) ? parseInt(width as string) : undefined);
			res.setHeader('Content-Type', 'image/jpeg');
			res.send(thumbnailBuffer);
		} catch (err) {
			console.error("Error while generating thumbnail for image:", relativePath);
			console.error(err.message);
			res.status(500).send("Error generating thumbnail");
		}
	})();
});
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
	console.log(`Listening on port ${port}`);

	// Setup slow jobs

});
