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
import fs, { readdirSync, watch } from 'fs';
import { ConfirmedPath, DirectoryService } from './services/DirectoryService';
import { LibraryService, Photo } from './services/LibraryService';
import { MediaMetadataService } from './services/metadata/MetadataService';
import { WatchProgress, WatchProgressService } from './services/WatchProgressService';
import mime from 'mime-types';
import { EitherMetadata } from './services/metadata/MetadataTypes';
import { ThumbnailService } from './services/ThumbnailService';
import { ProbeService } from './services/ProbeService';
import { useFfmpeg } from './utils/ffmpeg';
import { getBuildNumber } from './utils/versionService';
import { GetListByKeyword } from 'youtube-search-api';
import ytdl from '@distube/ytdl-core'
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';

const corsOptions = {};

// Safe response helper to prevent double responses
const safeResponse = {
	send: (res: any, statusCode: number, data?: any) => {
		if (!res.headersSent) {
			if (data) {
				res.status(statusCode).json(data);
			} else {
				res.sendStatus(statusCode);
			}
		}
	},
	json: (res: any, data: any, statusCode = 200) => {
		if (!res.headersSent) {
			res.status(statusCode).json(data);
		}
	},
	error: (res: any, message: string, statusCode = 500) => {
		if (!res.headersSent) {
			res.status(statusCode).json({ error: message });
		}
	}
};

app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));

// Request logging middleware
// app.use((req: any, res: any, next: any) => {
// 	const start = Date.now();

// 	// Log request
// 	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

// 	// Override res.end to log response
// 	const originalEnd = res.end;
// 	res.end = function (...args: any[]) {
// 		const duration = Date.now() - start;
// 		console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
// 		originalEnd.apply(this, args);
// 	};

// 	next();
// });

// Request timeout middleware
app.use((req: any, res: any, next: any) => {
	// Set timeout for all requests (30 seconds)
	req.setTimeout(30000, () => {
		if (!res.headersSent) {
			res.status(408).json({ error: 'Request timeout' });
		}
	});

	res.setTimeout(30000, () => {
		if (!res.headersSent) {
			res.status(408).json({ error: 'Response timeout' });
		}
	});

	next();
});

app.get('/health', (_, res) => res.sendStatus(200));

// get directory at relative path from media dir
app.get("/api/dir/", async function (req, res) {
	try {
		let { dir } = req.query;
		if (!dir) {
			return safeResponse.error(res, "Requires dir query param", 400);
		}
		if (dir === "/") {
			dir = "";
		}

		const resolvedPath = DirectoryService.resolvePath(dir as string);
		if (!resolvedPath) {
			return safeResponse.error(res, "Directory not found", 404);
		}

		const { folders, files } = await DirectoryService.listDirectory(resolvedPath);
		const libraryItem = await LibraryService.parseFolderToItem(resolvedPath, true);

		return safeResponse.json(res, {
			libraryItem,
			directory: {
				files: files.map((file) => file.name),
				folders: (await Promise.all(folders.map(async (folder) => {
					const libraryItem = await LibraryService.parseFolderToItem(folder.confirmedPath, true);
					return {
						folderName: folder.name,
						libraryItem,
					};
				}))).sort((a, b) => a.libraryItem?.sortKey.localeCompare(b.libraryItem?.sortKey || '') || 0),
			},
		});
	} catch (err) {
		console.error(err);
		safeResponse.error(res, "Error reading directory");
	}
});

app.get('/api/stream-yt-search', async (req, res) => {
	try {
		const { q } = req.query;
		if (!q) {
			res.status(400).send("Requires q query param");
			return;
		}
		const results = await GetListByKeyword(q, false, 20);
		const filteredResults = results.items.filter(item => item.type === 'video');
		const topResult = filteredResults[0];
		if (!topResult) {
			res.status(404).send("No results found");
			return;
		}
		const url = `https://www.youtube.com/watch?v=${topResult.id}`;
		const outputFilePath = path.join(__dirname, '../dist/assets/yt.mp3');

		ytdl.getInfo(url).then(info => {
			ytdl.downloadFromInfo(info, { quality: 'lowest' }).pipe(fs.createWriteStream(outputFilePath))
				.on('finish', () => {
					if (!res.headersSent) {
						res.sendFile(outputFilePath, (err) => {
							if (err && !res.headersSent) {
								console.error("Error while sending converted file:", err);
								res.status(500).send("Error sending converted file");
							}
						});
					}
				})
				.on('error', (err) => {
					console.error("Error writing yt stream to file:", err);
					if (!res.headersSent) {
						res.status(500).send("Error processing YouTube video");
					}
				});
		}).catch(err => {
			console.error("Error getting YouTube info:", err);
			if (!res.headersSent) {
				res.status(500).send("Error processing YouTube video");
			}
		});
	} catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal system error");
		}
	}
});


app.get("/api/stream", async function (req, res) {
	let { src } = req.query;
	if (!src) {
		res.status(400).send("Requires src query param");
		return;
	}
	const resolvedPath = DirectoryService.resolvePath(src as string);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}

	if (resolvedPath.relativePath.endsWith('.3gp')) {
		const outputFilePath = path.join(__dirname, '../dist/assets/conversion.mp4');
		await useFfmpeg(resolvedPath.absolutePath, (ffmpeg, resolve, reject) => {
			// Convert 3GP to MP4
			ffmpeg(resolvedPath.absolutePath)
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
			if (err && !res.headersSent) {
				console.error("Error while sending converted file:", err);
				res.status(500).send("Error sending converted file");
			}
		});
		return;
	}

	const streamable = ['mp4', 'mp3', 'm4b'];
	if (!streamable.some((ext) => resolvedPath.relativePath.endsWith(ext))) {
		res.status(400).send("File type not supported for streaming");
		return;
	}

	fs.stat(resolvedPath.absolutePath, function (err, stats) {
		if (err) {
			console.error(`Failed to load video file: "${resolvedPath}"`)
			console.error(err)
			if (err.code === 'ENOENT') {
				// 404 Error if file not found
				return res.sendStatus(404);
			}
			return res.status(500).send("Error loading file");
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
		let mimeType = mime.lookup(resolvedPath.absolutePath) || 'application/octet-stream';
		if (resolvedPath.relativePath.endsWith('.m4b')) {
			mimeType = 'audio/mp4'; // or 'audio/x-m4b'
		}

		res.writeHead(206, {
			"Content-Range": "bytes " + start + "-" + end + "/" + total,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": mimeType
		});

		const stream = fs.createReadStream(resolvedPath.absolutePath, { start: start, end: end })
			.on("open", function () {
				stream.pipe(res);
			}).on("error", function (err) {
				console.error("Error reading stream!", err)
				if (!res.headersSent) {
					res.status(500).send("Error reading file");
				}
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
	const resolvedPath = DirectoryService.resolvePath(src as string);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}
	const outputFilePath = path.join(__dirname, '../dist/assets/conversion.mp3');
	await useFfmpeg(resolvedPath.absolutePath, (ffmpeg, resolve, reject) => {
		ffmpeg.outputOptions(`-map 0:${index}`)
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
		if (!res.headersSent) {
			res.status(500).send("Error sending converted file");
		}
	});
	if (!res.headersSent) {
		res.sendStatus(200);
	}
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
		const resolvedPath = DirectoryService.resolvePath(path);
		if (!resolvedPath) {
			res.json({
				error: 'File not found',
				success: false,
				data: null,
			});
			return;
		}
		let mediaType = type;
		if (!mediaType) {
			mediaType = LibraryService.determineMediaTypeFromPath(resolvedPath.relativePath);
		}
		const metadata = await MediaMetadataService.getMetadata(mediaType, resolvedPath, detailed);
		res.json({
			data: metadata,
		})
	}
	catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
});



app.get('/api/watchProgress', async (req, res) => {
	try {
		const { relativePath } = req.query;
		const resolvedPath = DirectoryService.resolvePath(relativePath as string);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}
		const progress = await WatchProgressService.getWatchProgress(resolvedPath);
		res.json({
			data: progress,
		})
	}
	catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
});
app.post('/api/watchProgress', async (req, res) => {
	try {
		const { relativePath, progress, bookmarkId } = req.body;
		const resolvedPath = DirectoryService.resolvePath(relativePath);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}

		await WatchProgressService.updateWatchProgress(resolvedPath, progress, bookmarkId);
		res.json({
			success: true,
		})
	}
	catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
});
app.delete('/api/watchProgress/bookmark', async (req, res) => {
	try {
		const { relativePath, bookmarkId } = req.body;
		const resolvedPath = DirectoryService.resolvePath(relativePath);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}
		await WatchProgressService.deleteBookmark(resolvedPath, bookmarkId);
		res.json({
			success: true,
		})
	}
	catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
});






app.get('/api/theaterData', async (req, res) => {
	try {
		const { relativePath } = req.query;
		if (!relativePath) {
			res.status(400).send("Requires relativePath query param");
			return;
		}
		const resolvedPath = DirectoryService.resolvePath(relativePath as string);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}
		const libraryData = await LibraryService.getLibraryForPlayable(resolvedPath);
		const probe = await ProbeService.getProbeData(resolvedPath);
		res.json({
			data: {
				playable: libraryData.playable,
				parentLibrary: libraryData.parentLibrary,
				probe: probe?.glossary,
			},
		})
	}
	catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
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
				metadata?: EitherMetadata | null;
				watchProgress?: WatchProgress;
				libraryItem?: any;
				isUpNext?: boolean;
			}>;
		}>;

		type ContinueWatchingItem = WatchProgress & {
			confirmedPath: ConfirmedPath;
			isUpNext?: boolean;
		}

		// Continue Watching
		// Make sure cached items still exist!!!
		const watchItems: ContinueWatchingItem[] = await WatchProgressService.getContinueWatchingList().map((progress) => ({
			...progress,
			watchedAt: progress.watchedAt,
			confirmedPath: DirectoryService.resolvePath(progress.relativePath),
		})).filter(i => i.confirmedPath) as ContinueWatchingItem[];
		const lastFinishedEpisodes = await WatchProgressService.getLastFinishedEpisodes();
		await Promise.all(lastFinishedEpisodes.map(async ep => {
			if (ep && DirectoryService.resolvePath(ep.relativePath)) {
				const nextEpisode = await LibraryService.getNextEpisode(DirectoryService.resolvePath(ep.relativePath)!);
				if (nextEpisode) {
					watchItems.unshift({ ...nextEpisode, watchedAt: ep.watchedAt, isUpNext: true } as any);
				}
			}
		}));
		if (watchItems.length > 0) {
			feedLists.push({
				title: "Continue Watching",
				type: "continue-watching",
				items: (await Promise.all(watchItems.map(async (item) => ({
					title: LibraryService.parseNamePieces(item.relativePath).name,
					relativePath: item.relativePath,
					watchProgress: item,
					watchedAt: item.watchedAt,
					metadata: MediaMetadataService.getMetadata(
						LibraryService.determineMediaTypeFromPath(item.relativePath) as any,
						item.confirmedPath,
					),
					probe: await ProbeService.getProbeData(item.confirmedPath),
					libraryItem: await LibraryService.getLibraryForPlayable(item.confirmedPath),
					isUpNext: item.isUpNext,
				})))).sort((a, b) => b.watchedAt - a.watchedAt),
			});
		}

		const libraries = await LibraryService.getRootLibraries();


		// // New Movies and shows!
		// Need to get filestats for all items
		const mediaTypes = ['', 'audio'];
		const mediaLibraries = libraries.filter((library) => mediaTypes.includes(library.libraryType));
		const allMediaItems = (await Promise.all(mediaLibraries.map(async (library) => {
			const { items } = await LibraryService.getFlatTree(library.confirmedPath);
			// async filestats for each file
			return await Promise.all(items.map(async (item, i) => {
				if (!['cinema', 'audiobook'].includes(item.type)) {
					return null; // Skip folders
				}
				const fullPath = DirectoryService.resolvePath(item.relativePath)?.absolutePath!;
				const stat = await fs.promises.stat(fullPath).catch(() => null);
				return {
					...item,
					createdAt: stat ? stat.birthtime : null, // Use birthtime for creation
				}
			}));
		}))).flat().filter(i => !!i && ((Date.now() - (i.createdAt?.getTime() || 0)) < 1000 * 60 * 60 * 24 * 30)).sort((a, b) => {
			if (!a?.createdAt) {
				return 1;
			}
			if (!b?.createdAt) {
				return -1;
			}
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
		const newItems = await Promise.all(allMediaItems.slice(0, 10).map(async (item) => ({
			libraryItem: {
				...item,
				watchProgress: await WatchProgressService.getWatchProgress(DirectoryService.resolvePath(item!.relativePath)!),
			},
			relativePath: item!.relativePath,
		})));
		if (newItems.length > 0) {
			feedLists.push({
				title: "New Media",
				type: "new-items",
				items: newItems,
			});
		}

		// identify photo libraries
		const photoLibraries = libraries.filter((library) => library.libraryType === 'photos');
		const allPhotos = (await Promise.all(photoLibraries.map(async (library) => {
			const { files } = await LibraryService.getFlatTree(library.confirmedPath);
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
		const dayRange = 2;
		const today = new Date();
		const pastPhotos = allPhotos.filter((photo) => {
			if (!photo.takenAt) {
				return false;
			}
			const photoDate = new Date(photo.takenAt);
			if (photoDate.getFullYear() === today.getFullYear()) {
				return false; // skip photos from this year
			}
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
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
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
		const resolvedPath = DirectoryService.resolvePath(name);
		if (!resolvedPath) {
			throw Error('No such folder')
		}
		const items = await LibraryService.getFlatTree(resolvedPath);
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
		if (!fullPath) {
			res.status(404).send("File not found");
			return;
		}
		const probe = await ProbeService.getProbeData(fullPath);

		const subtitleStream = probe?.full.streams[index];

		if (subtitleStream && (subtitleStream.codec_type === 'subtitle' || subtitleStream.tags?.handler_name === 'SubtitleHandler')) {
			if (subtitleStream.codec_name === 'mov_text') {
				const subtitleIndex = subtitleStream.index;
				const outputFilePath = path.join(__dirname, '../dist/assets/output.vtt');

				useFfmpeg(fullPath.absolutePath, (ffmpeg) => {
					ffmpeg.outputOptions(`-map 0:${subtitleIndex}`)
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
				});

			}
			else if (subtitleStream.codec_name === 'dvd_subtitle') {
				// extract to .idx and .sub, then recognize with tesseract
				const subtitleIndex = subtitleStream.index;
				const outFile = path.join(__dirname, '../dist/assets/temp.sup');

				// Extract VobSub subtitles
				useFfmpeg(fullPath.absolutePath, (ffmpeg) => {
					ffmpeg.outputOptions(`-map 0:${subtitleIndex}`)
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
				})

			}
			else if (subtitleStream.codec_name === 'bin_data') {
				// Log the binary data as text
				// use ffmpeg to pass the data into a buffer and send it as text
				const subtitleIndex = subtitleStream.index;
				const outputFilePath = path.join(__dirname, '../dist/assets/output.txt');
				useFfmpeg(fullPath.absolutePath, (ffmpeg) => {
					ffmpeg.outputOptions(`-map 0:${subtitleIndex}`)
						.outputOptions('-f srt') // Output format as SRT
						.save(outputFilePath)
						.on('end', () => {
							// set cors header
							res.setHeader('Access-Control-Allow-Origin', '*');
							res.setHeader('Content-Type', 'text/plain');
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
				});
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


// Sub Routes
import timerRoute from './routes/timer.route'
app.use('/api/timer', timerRoute);
import scrubRoute from './routes/scrub.route'
app.use('/api/scrub', scrubRoute);
import surpriseRoute from './routes/surprise.route'
app.use('/api/surprise', surpriseRoute);




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
	const resolvedPath = DirectoryService.resolvePath(relativePath);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}
	(async () => {
		// Gifs don't work if sharp resizes them, so just send he og file.
		// Consider using gif-encode in the future if gifs are too large and still need to be resized.
		if (resolvedPath.relativePath.endsWith('.gif')) {
			res.sendFile(resolvedPath.absolutePath);
			return;
		}
		try {
			const thumbnailBuffer = await ThumbnailService.streamThumbnail(resolvedPath, !isNaN(width) ? parseInt(width as string) : undefined);
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

// Global error handler middleware
app.use((err: any, req: any, res: any, next: any) => {
	console.error('Global error handler caught:', err);

	// If response already sent, delegate to default Express error handler
	if (res.headersSent) {
		return next(err);
	}

	// Send error response
	res.status(500).json({
		error: 'Internal server error',
		message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
	});
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
	// Log the error but don't exit the process immediately
	// Consider using a proper logging service in production
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	// Log the error but don't exit the process
});

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
	console.log(`Listening on port ${port}`);
	console.log(`Process ID: ${process.pid}`);
	console.log(`Node.js version: ${process.version}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
	console.log(`Received ${signal}. Starting graceful shutdown...`);

	server.close(() => {
		console.log('HTTP server closed.');
		process.exit(0);
	});

	// Force shutdown after 10 seconds
	setTimeout(() => {
		console.error('Could not close connections in time, forcefully shutting down');
		process.exit(1);
	}, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Log memory usage periodically (optional, for debugging)
if (process.env.NODE_ENV === 'development') {
	setInterval(() => {
		const memUsage = process.memoryUsage();
		console.log('Memory usage:', {
			rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
			heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
			heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
		});
	}, 60000); // Every minute
}
