import dotenv from 'dotenv';
dotenv.config();

import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

const { json, urlencoded } = bodyParser as any;
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import express, { Request, Response } from 'express';
import 'express-async-errors';
const app = express();

import cors from 'cors';
import fs, { readdirSync, watch } from 'fs';
import { ConfirmedPath, DirectoryService } from './services/DirectoryService';
import { LibraryService, Photo } from './services/LibraryService';
import { NowPlayingService } from './services/NowPlayingService';
import { MediaMetadataService } from './services/metadata/MetadataService';
import { ProfileService } from './services/ProfileService';
import { Bookmark, WatchProgressService } from './services/WatchProgressService';
import mime from 'mime-types';
import { EitherMetadata } from './services/metadata/MetadataTypes';
import { ThumbnailService } from './services/ThumbnailService';
import { ProbeService } from './services/ProbeService';
import { useFfmpeg } from './utils/ffmpeg';
import { getBuildNumber } from './utils/versionService';
import { GetListByKeyword } from 'youtube-search-api';
import ytdl from '@distube/ytdl-core'

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

const corsOptions: cors.CorsOptions = {
	origin: (origin: string, callback: any) => {
		// console.log(origin, allowedOrigins)
		// Allow non-browser clients or same-origin requests (no Origin header)
		if (!origin) {
			return callback(null, true);
		}

		// If no allowlist is configured, reflect the request origin
		if (allowedOrigins.length === 0) {
			return callback(null, true);
		}

		return callback(null, allowedOrigins.some(o => origin.includes(o)));
	},
	credentials: true,
};

// Safe response helper to prevent double responses
function safeRes(res: Response) {
	return res.headersSent ? undefined : res;
}
const safeResponse = {
	send: (res: any, statusCode: number, data?: any) => {
		if (data) {
			safeRes(res)?.status(statusCode).json(data);
		}
 else {
			safeRes(res)?.sendStatus(statusCode);
		}
	},
	json: (res: any, data: any, statusCode = 200) => {
		safeRes(res)?.status(statusCode).json(data);
	},
	error: (res: any, message: string, statusCode = 500) => {
		safeRes(res)?.status(statusCode).json({ error: message });
	}
};

app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));

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


// authentication routes
import authRoute from './routes/auth.route'
app.use('/api/auth', authRoute);
import { getSession, getSessionEmail, SessionService } from './services/SessionService';

// authentication middleware, gates all other endpoints
app.use('/api/*', SessionService.sessionAuthMiddleware)

app.use('/api/session', (req, res, next) => {
	res.send(getSession())
})

type ReqWithPath = Request & { confirmedPath: ConfirmedPath };

app.use('/api/*', async (req, res, next) => {
	let path = '';
	if (typeof req.query?.path === 'string') {
		path = decodeMediaPath(req.query.path);
		req.query.path = path;
	};
	if (typeof req.body?.path === 'string') {
		path = decodeMediaPath(req.body.path);
		req.body.path = path;
	};

	if (path) {
		const confirmedPath = DirectoryService.confirmPath(path);
		if (!confirmedPath) {
			res.status(404).send("File not found");
			return;
		}
		(req as ReqWithPath).confirmedPath = confirmedPath;
		const isShared = await SharingService.isShared(path, getSessionEmail());
		if (!isShared) {
			return res.sendStatus(409);
		}
	}

	next();
})

// Sub Routes
import timerRoute from './routes/timer.route'
app.use('/api/timer', timerRoute);
import scrubRoute from './routes/scrub.route'
app.use('/api/scrub', scrubRoute);
import surpriseRoute from './routes/surprise.route'
app.use('/api/surprise', surpriseRoute);
import jobRoute from './routes/job.route'
app.use('/api/job', jobRoute);
import shareRoute from './routes/share.route'
app.use('/api/share', shareRoute);
import loanRoute from './routes/loan.route'
app.use('/api/loan', loanRoute);
import subtitlesRoute from './routes/subtitles.route'
app.use('/api/subtitles', subtitlesRoute);
import mseRoute from './routes/mse.route'
app.use('/api/mse', mseRoute);
import nowPlayingRoute from './routes/now-playing.route'
app.use('/api/now-playing', nowPlayingRoute);
import profileRoute from './routes/profile.route'
app.use('/api/profiles', profileRoute);

import { decodeMediaPath, safeParseInt } from './utils/miscUtils';
import { hash } from './utils/hash';
import { JobService } from './services/JobService';
import { SharingService } from './services/SharingService';
import { LoanService } from './services/LoanService';

// get directory at relative path from media dir
app.get("/api/dir/", async function (req, res) {
	try {
		let { path } = req.query;
		if (!path) {
			return safeResponse.error(res, "Requires path query param", 400);
		}
		if (path === "/") {
			path = "";
		}

		const resolvedPath = DirectoryService.confirmPath(path as string);
		if (!resolvedPath) {
			return safeResponse.error(res, "Directory not found", 404);
		}

		const { folders, files } = await DirectoryService.listDirectory(resolvedPath);
		const libraryItem = await LibraryService.parseFolderToItem(resolvedPath, true);
		const rootLibrary = await LibraryService.parseFolderToItem(resolvedPath.rootFolder)
		return safeResponse.json(res, {
			rootLibrary,
			libraryItem,
			directory: {
				files: files.map((file) => file.name),
				folders: folders,
				libraryItems: (await Promise.all(folders.map(async (folder) => await LibraryService.parseFolderToItem(folder.confirmedPath)))).filter(Boolean).sort((a, b) => a!.sortKey?.localeCompare(b!.sortKey || '') || 0),
				galleryFiles: (await Promise.all(files.map(async (file) => await LibraryService.parseFileToContentItem(file.confirmedPath)))).filter(Boolean),
			},
		});
	}
 catch (err) {
		console.error(err);
		safeResponse.error(res, "Error reading directory");
	}
});

app.post("/api/emptyCaches", async function (req, res) {
	try {
		LibraryService.emptyCaches();
		ProbeService.clearEntireCache();
		return safeResponse.send(res, 200);
	}
 catch (err) {
		console.error(err);
		safeResponse.error(res, "Error reading directory");
	}
})

app.post("/api/refresh", async function (req, res) {
	try {
		const { path } = req.query;
		const resolvedPath = DirectoryService.confirmPath(path as string);
		if (!resolvedPath) {
			return safeResponse.error(res, "Directory not found", 404);
		}

		// clear probe cache first so library gets fresh data
		ProbeService.clearCacheForPath(resolvedPath.relativePath);
		const newItem = await LibraryService.reloadLibraryItemData(resolvedPath);
		if (newItem?.type === 'cinema') {
			await MediaMetadataService.getMetadata(newItem.cinemaType, resolvedPath, false, true);
		}

		return safeResponse.send(res, 200);
	}
 catch (err) {
		console.error(err);
		safeResponse.error(res, "Error reading directory");
	}
})

app.get('/api/stream-yt-search', async (req, res) => {
	try {
		const { q } = req.query;
		if (!q) {
			res.status(400).send("Requires q query param");
			return;
		}
		const results = await GetListByKeyword(q as string, false, 20);
		const filteredResults = results.items.filter(item => item.type === 'video');
		const topResult = filteredResults[0];
		if (!topResult) {
			res.status(404).send("No results found");
			return;
		}
		const url = `https://www.youtube.com/watch?v=${topResult.id}`;
		const outputFilePath = path.join(__dirname, '../dist/assets/yt.mp3');

		const agent = ytdl.createAgent([
			{
				"name": "__Secure-YNID",
				"value": "18.YT=y9ovSH8UT8rXa9gd3t1u9p-YLGcNSPtVJvaaUhg1zuuYzIOMdXFIdbVKUR3SyrhHo1B3eaHla0z_tFTbbi0DUKvIksVvLJLJKHWy0k9KP7-DY2vAqC6oiu4-E9XNhre6JOuOi0w3A3tA6oTpieuzTAOi2o6zGL21eHe7zs0ARtQ0AG1L_p1qwVeQKXQHxko4DQKBz603Cdzds-zpiQo2SD6NX-9VtdFn51VB4RZGSJ_VQ3DMjYyrAOlIcev1Lcmr4yfkUEzq4JwGxoJ2VQhY9CAn7FHTzQmg1BP3oDnE94gkDjaoLbxQulfh-K5waRSd63iSWHITde8LyS3TgwbfQQ",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1794760526.969,
			},
			{
				"name": "GPS",
				"value": "1",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1779210327.03,
			},
			{
				"name": "YSC",
				"value": "6ELcP-ibU9k",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
			},
			{
				"name": "VISITOR_INFO1_LIVE",
				"value": "D-p3Zv9FZTs",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1794760530.344,
			},
			{
				"name": "VISITOR_PRIVACY_METADATA",
				"value": "CgJVUxIEGgAgLA%3D%3D",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1794760530.344,
			},
			{
				"name": "PREF",
				"value": "f4=4000000&tz=America.Denver",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1813768532.045,
			},
			{
				"name": "__Secure-1PSIDTS",
				"value": "sidts-CjQBhkeRd8cVmecHiYVgYJBl4Iq1XAIlOs_B9wDtO96eEX-8rZlcC-UooeuDjKO5L_d1_hh_EAA",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1810755180.358,
			},
			{
				"name": "__Secure-3PSIDTS",
				"value": "sidts-CjQBhkeRd8cVmecHiYVgYJBl4Iq1XAIlOs_B9wDtO96eEX-8rZlcC-UooeuDjKO5L_d1_hh_EAA",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1810755180.358,
			},
			{
				"name": "HSID",
				"value": "AlBsyfbOILHaulUV7",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "SSID",
				"value": "AHgF_f4U31cWeMdEp",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "APISID",
				"value": "KZiO8IZhcsA2RbhR/Aa6g2kp2K9m00zGqb",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "SAPISID",
				"value": "oemHn3lacVx6ryg9/Am0jqnFM4MPJygpyW",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "__Secure-1PAPISID",
				"value": "oemHn3lacVx6ryg9/Am0jqnFM4MPJygpyW",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "__Secure-3PAPISID",
				"value": "oemHn3lacVx6ryg9/Am0jqnFM4MPJygpyW",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": false,
				"sameSite": "no_restriction",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "SID",
				"value": "g.a000-Aix0flc3RLP0UG3MdaIYfTShQvz_rsnnoiQqp5f3LUB4vQxqoatwwv4ILYbAYttXplAdgACgYKARQSARYSFQHGX2MikB1t3Z7WfD9p-gbNBmbAthoVAUF8yKplLIxNVy2Az1e_ZswOrb250076",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "__Secure-1PSID",
				"value": "g.a000-Aix0flc3RLP0UG3MdaIYfTShQvz_rsnnoiQqp5f3LUB4vQxtgn2XhXPtoPN4L-JVjVjyQACgYKAZkSARYSFQHGX2MiyNk8GafLvdTuFpBI1LQh5hoVAUF8yKpB82I8HOjffE1FjY7YNnHn0076",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "__Secure-3PSID",
				"value": "g.a000-Aix0flc3RLP0UG3MdaIYfTShQvz_rsnnoiQqp5f3LUB4vQxn0-FiJ5g20BHQDeEm0PWywACgYKARcSARYSFQHGX2MiUcdpH0z9gNakhb39zJPnrBoVAUF8yKo6Mm6VslU91WhspBsCozsG0076",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1813768529.395,
			},
			{
				"name": "LOGIN_INFO",
				"value": "AFmmF2swRQIhAOCLyElU0EZ9beR1KCuWkERLi5EyZLv79NkP85YH5KoPAiB4Mgfyt-RSlX_jfOAqzHx_Oi2AOAnU9JBkSTtuKT_HQA:QUQ3MjNmemlZdGRJaWJrVGlnLVZXcklQYlgwUmVVOHZ6M0tMaTBjZmQwSE5uYmh1bVl0a0RnQmxodGtfeGFlcUx2V09ubldtckJlbTVhX1I0dGtNTHd3NFRzbW01Vmd2YmtZX0N6R0o3MHZsbDN5d1pYNDFCVElDaXR2RXc4UFVodEdxQ0Zhb1RrZ0FSYXY0TlZ3aHN4czRSY0ZSVlRDdUdn",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1813768529.661,
			},
			{
				"name": "SIDCC",
				"value": "AKEyXzW5rncppYKXLUfe9Hy4rrMYdwQ77xh3lPf1C8ylAYxP_Jt21rP_eedUpdioOZjp35EPKg",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1810755180.358,
			},
			{
				"name": "__Secure-1PSIDCC",
				"value": "AKEyXzXsrJM-sKV4zUfvHRtXQmGEKASYJ4A2AKJW3bSnsb-dRpDbQAxk0xTNpx3HXT690JqWbw",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "unspecified",
				"expirationDate": 1810755180.358,
			},
			{
				"name": "__Secure-3PSIDCC",
				"value": "AKEyXzWRr95qGkxG_v16twbtdj-WVcPQ6d9LdtH2tmo-ZjAbQmGXZJPYJRuJBMXPvpwv9TLv",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": true,
				"httpOnly": true,
				"sameSite": "no_restriction",
				"expirationDate": 1810755180.358,
			},
			{
				"name": "ST-l3hjtt",
				"value": "session_logininfo=AFmmF2swRQIhAOCLyElU0EZ9beR1KCuWkERLi5EyZLv79NkP85YH5KoPAiB4Mgfyt-RSlX_jfOAqzHx_Oi2AOAnU9JBkSTtuKT_HQA%3AQUQ3MjNmemlZdGRJaWJrVGlnLVZXcklQYlgwUmVVOHZ6M0tMaTBjZmQwSE5uYmh1bVl0a0RnQmxodGtfeGFlcUx2V09ubldtckJlbTVhX1I0dGtNTHd3NFRzbW01Vmd2YmtZX0N6R0o3MHZsbDN5d1pYNDFCVElDaXR2RXc4UFVodEdxQ0Zhb1RrZ0FSYXY0TlZ3aHN4czRSY0ZSVlRDdUdn",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1779208536,
			},
			{
				"name": "ST-tladcw",
				"value": "session_logininfo=AFmmF2swRQIhAOCLyElU0EZ9beR1KCuWkERLi5EyZLv79NkP85YH5KoPAiB4Mgfyt-RSlX_jfOAqzHx_Oi2AOAnU9JBkSTtuKT_HQA%3AQUQ3MjNmemlZdGRJaWJrVGlnLVZXcklQYlgwUmVVOHZ6M0tMaTBjZmQwSE5uYmh1bVl0a0RnQmxodGtfeGFlcUx2V09ubldtckJlbTVhX1I0dGtNTHd3NFRzbW01Vmd2YmtZX0N6R0o3MHZsbDN5d1pYNDFCVElDaXR2RXc4UFVodEdxQ0Zhb1RrZ0FSYXY0TlZ3aHN4czRSY0ZSVlRDdUdn",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1779208536,
			},
			{
				"name": "ST-xuwub9",
				"value": "session_logininfo=AFmmF2swRQIhAOCLyElU0EZ9beR1KCuWkERLi5EyZLv79NkP85YH5KoPAiB4Mgfyt-RSlX_jfOAqzHx_Oi2AOAnU9JBkSTtuKT_HQA%3AQUQ3MjNmemlZdGRJaWJrVGlnLVZXcklQYlgwUmVVOHZ6M0tMaTBjZmQwSE5uYmh1bVl0a0RnQmxodGtfeGFlcUx2V09ubldtckJlbTVhX1I0dGtNTHd3NFRzbW01Vmd2YmtZX0N6R0o3MHZsbDN5d1pYNDFCVElDaXR2RXc4UFVodEdxQ0Zhb1RrZ0FSYXY0TlZ3aHN4czRSY0ZSVlRDdUdn",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1779208537,
			},
			{
				"name": "ST-3opvp5",
				"value": "session_logininfo=AFmmF2swRQIhAOCLyElU0EZ9beR1KCuWkERLi5EyZLv79NkP85YH5KoPAiB4Mgfyt-RSlX_jfOAqzHx_Oi2AOAnU9JBkSTtuKT_HQA%3AQUQ3MjNmemlZdGRJaWJrVGlnLVZXcklQYlgwUmVVOHZ6M0tMaTBjZmQwSE5uYmh1bVl0a0RnQmxodGtfeGFlcUx2V09ubldtckJlbTVhX1I0dGtNTHd3NFRzbW01Vmd2YmtZX0N6R0o3MHZsbDN5d1pYNDFCVElDaXR2RXc4UFVodEdxQ0Zhb1RrZ0FSYXY0TlZ3aHN4czRSY0ZSVlRDdUdn",
				"domain": ".youtube.com",
				"hostOnly": false,
				"path": "/",
				"secure": false,
				"httpOnly": false,
				"sameSite": "unspecified",
				"expirationDate": 1779219225,
			}
		]);

		ytdl.getInfo(url, { agent }).then(info => {
			ytdl.downloadFromInfo(info, { quality: 'lowest', agent }).pipe(fs.createWriteStream(outputFilePath))
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
			console.error("Error getting YouTube info:", err, url);
			if (!res.headersSent) {
				res.status(500).send("Error processing YouTube video");
			}
		});
	}
 catch (err) {
		console.error(err)
		if (!res.headersSent) {
			res.status(500).send("Internal system error");
		}
	}
});


app.get("/api/stream", async function (req, res) {
	const { path: relativePath } = req.query;
	if (!relativePath) {
		res.status(400).send("Requires src query param");
		return;
	}
	const resolvedPath = DirectoryService.confirmPath(relativePath as string);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}

	if (!await LoanService.canStreamMedia(resolvedPath, getSessionEmail())) {
		res.status(401).send("Not allowed");
		return;
	}

	if (resolvedPath.relativePath.endsWith('.3gp')) {
		const outputFilePath = path.join(__dirname, '../dist/assets/conversion.mp4');
		await useFfmpeg(async (ffmpeg, resolve, reject) => {
			// Convert 3GP to MP4
			ffmpeg(resolvedPath.absolutePath).output(outputFilePath)
				.outputOptions('-preset veryfast')
				.on('end', () => {
					resolve();
				})
				.on('error', (err: any) => {
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

	const streamable = ['mp4', 'mp3', 'm4b', 'flac', 'mkv'];
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
	const { path: relativePath, index } = req.body;

	if (!relativePath) {
		res.status(400).send("Requires src query param");
		return;
	}
	if (!index) {
		res.status(400).send("Requires index query param");
		return;
	}
	const resolvedPath = DirectoryService.confirmPath(relativePath as string);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}

	// Setup a job for the frontend to ping
	const job = JobService.addJob({
		type: 'extract_audio_stream',
		priority: true,
		handler: async ({ progress }) => {
			// Use ffmpeg to extract indicated audio stream from video file as mp4
			// This should be coming from an m-4 video file, so keeping the same codec means we can do a direct copy
			const outputFilePath = path.join(__dirname, '../dist/assets/secondary-audio.mp4');
			await useFfmpeg(async (ffmpeg, resolve, reject) => {
				ffmpeg(resolvedPath.absolutePath)
					.outputOptions([`-map 0:${index}`, '-c copy'])
					.output(outputFilePath)
					.on('progress', (data: { percent: number }) => {
						progress(data.percent)
					})
					.on('end', () => {
						resolve();
					})
					.on('error', (err: any) => {
						reject(err);
					})
					.run();
			}).catch((err) => {
				console.error("Error while sending converted file:", err);
				throw (err);
			});
		}
	})

	safeRes(res)?.send({
		success: true,
		data: {
			jobId: job.jobId,
		}
	})
});

app.post('/api/remux', async (req, res) => {
	const { path: relativePath } = req.body;
	if (!relativePath) {
		res.status(400).send("Requires path");
		return;
	}
	const resolvedPath = DirectoryService.confirmPath(relativePath);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}
	if (!resolvedPath.relativePath.endsWith('.mkv')) {
		res.status(400).send("Only MKV files can be remuxed");
		return;
	}
	if (!await LoanService.canStreamMedia(resolvedPath, getSessionEmail())) {
		res.status(401).send("Not allowed");
		return;
	}

	const cacheDir = path.join(__dirname, '../dist/assets/remux-cache');
	const cacheKey = Math.abs(hash(relativePath)).toString(16);
	const cachePath = path.join(cacheDir, `${cacheKey}.mp4`);
	const clientPath = `/assets/remux-cache/${cacheKey}.mp4`;

	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	const job = JobService.addJob({
		type: 'remux_mkv',
		priority: true,
		handler: async ({ progress }) => {
			if (fs.existsSync(cachePath)) {
				return;
			}
			// Remove any previously cached remux files
			for (const file of fs.readdirSync(cacheDir)) {
				fs.rmSync(path.join(cacheDir, file));
			}
			await useFfmpeg(async (ffmpeg, resolve, reject) => {
				ffmpeg(resolvedPath.absolutePath)
					.outputOptions(['-c:v copy', '-c:a copy', '-sn', '-movflags +faststart'])
					.output(cachePath)
					.on('progress', (data: { percent: number }) => {
						progress(data.percent);
					})
					.on('end', resolve)
					.on('error', (err: any) => {
						console.error('Error remuxing MKV:', err.message);
						reject(err);
					})
					.run();
			});
		}
	});

	res.json({ jobId: job.jobId, path: clientPath });
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
		const resolvedPath = DirectoryService.confirmPath(path);
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


app.get('/api/metadata/person/:personId', async (req, res) => {
	try {
		const { personId } = req.params;
		const person = await MediaMetadataService.getMetadata('person', personId);
		res.json({
			data: person,
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
		const { path } = req.query;
		const resolvedPath = DirectoryService.confirmPath(path as string);
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
		const { path, progress, bookmarkKeys } = req.body;
		const resolvedPath = DirectoryService.confirmPath(path);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}

		await WatchProgressService.updateWatchProgress(resolvedPath, progress, bookmarkKeys);
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
		const { path, bookmarkId } = req.body;
		const resolvedPath = DirectoryService.confirmPath(path);
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
app.delete('/api/watchProgress', async (req, res) => {
	try {
		const { path } = req.body;
		const resolvedPath = DirectoryService.confirmPath(path);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}
		await WatchProgressService.deleteWatchProgress(resolvedPath);
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
		const { path } = req.query;
		if (!path) {
			res.status(400).send("Requires relativePath query param");
			return;
		}
		const resolvedPath = DirectoryService.confirmPath(path as string);
		if (!resolvedPath) {
			res.status(404).send("File not found");
			return;
		}
		const libraryData = await LibraryService.getLibraryForContentFile(resolvedPath);
		if (!libraryData) {
			res.status(404).send("Data not found");
			return;
		}
		const probe = await ProbeService.getProbeData(resolvedPath);
		res.json({
			data: {
				content: libraryData.content,
				parentTitle: libraryData.parentTitle,
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
				watchProgress?: Bookmark;
				libraryItem?: any;
				isUpNext?: boolean;
			}>;
		}>;

		type ContinueWatchingItem = Bookmark & {
			confirmedPath: ConfirmedPath;
			isUpNext?: boolean;
		}

		// Continue Watching
		// Make sure cached items still exist!!!
		let watchItems: ContinueWatchingItem[] = (await WatchProgressService.getContinueWatchingList()).map((progress) => ({
			...progress,
			watchedAt: progress.watchedAt,
			confirmedPath: DirectoryService.confirmPath(progress.relativePath),
		})).filter(i => i.confirmedPath) as ContinueWatchingItem[];


		const lastFinishedEpisodes = await WatchProgressService.getLastFinishedEpisodes();
		await Promise.all(lastFinishedEpisodes.map(async ep => {
			if (ep && DirectoryService.confirmPath(ep.relativePath)) {
				const nextEpisode = await LibraryService.getNextEpisode(DirectoryService.confirmPath(ep.relativePath)!);
				if (nextEpisode) {
					watchItems.push({ ...nextEpisode, watchedAt: ep.watchedAt, isUpNext: true } as any);
				}
			}
		}));

		// make sure all watchItems are STILL accessible to email
		watchItems = await SharingService.getSharedOnly(watchItems, getSessionEmail(), w => w.relativePath);

		const continueFeedItems = (await Promise.all(watchItems.map(async (item) => ({
			title: LibraryService.parseNamePieces(item.relativePath).name,
			relativePath: item.relativePath,
			watchProgress: item,
			watchedAt: item.watchedAt,
			metadata: MediaMetadataService.getMetadata(
				LibraryService.determineMediaTypeFromPath(item.relativePath) as any,
				item.confirmedPath,
			),
			duration_s: (await ProbeService.getProbeData(item.confirmedPath))?.glossary.duration_s,
			libraryItems: await LibraryService.getLibraryForContentFile(item.confirmedPath),
			isUpNext: item.isUpNext,
		})))).sort((a, b) => b.watchedAt - a.watchedAt).filter(i => i.libraryItems && !i.libraryItems.parentTitle?.surprise);

		if (continueFeedItems.length > 0) {
			feedLists.push({
				title: "Continue Watching",
				type: "continue-watching",
				items: continueFeedItems,
			});
		}

		const libraries = await LibraryService.getRootLibraries();

		// // New Movies and shows!
		// Need to get filestats for all items
		const mediaTypes = ['cinema', 'audio'];
		const mediaLibraries = libraries.filter((library) => mediaTypes.includes(library.libraryType));
		const allMediaItems = (await Promise.all(mediaLibraries.map(async (library) => {
			const { items } = await LibraryService.getFlatTree(library.confirmedPath);
			// async filestats for each file
			return await Promise.all(items.map(async (item, i) => {
				if (item.libraryTier !== 'title') {
					return null; // Only include title-tier items in the feed
				}
				const fullPath = DirectoryService.confirmPath(item.relativePath)?.absolutePath!;
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
				watchProgress: await WatchProgressService.getWatchProgress(DirectoryService.confirmPath(item!.relativePath)!),
			},
			relativePath: item!.relativePath,
		})));
		if (newItems.length > 0) {
			feedLists.push({
				title: "New Media",
				type: "items",
				items: newItems,
			});
		}

		// Loaned Items
		const email = getSessionEmail();
		const activeLoans = await LoanService.getLoansByEmail(email);
		const loanedItems = (await Promise.all(activeLoans.map(async (loan) => ({
			libraryItem: {
				...await LibraryService.parseFolderToItem(DirectoryService.confirmPath(loan.relativePath)!),
				watchProgress: await WatchProgressService.getWatchProgress(DirectoryService.confirmPath(loan.relativePath)!),
			},
			relativePath: loan.relativePath,
			expires: loan.expires,
		})))).filter(item => item.libraryItem);

		if (loanedItems.length > 0) {
			feedLists.push({
				title: "Your Active Loans",
				type: "items",
				items: loanedItems,
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

app.get('/api/trailers', async (req, res) => {
	try {
		const { confirmedPath } = req as ReqWithPath;
		const { profileId } = req.query;
		let directories: undefined | Array<ConfirmedPath>;
		if (profileId) {
			const profile = await ProfileService.getById(profileId as string);
			if (profile?.mode === 'theater' && profile.nowPlayingConfig) {
				const { sources } = NowPlayingService.getTodaySources(profile.nowPlayingConfig);
				directories = sources.map(s => DirectoryService.confirmPath(s.directory)).filter(s => s !== undefined);
			}
		}
		const trailers = await LibraryService.getRandomTrailers(confirmedPath.relativePath, directories);

		res.json({
			success: true,
			data: trailers,
		})
	}
	catch (err) {
		console.error(err)
		res.send(500)
	}
});

app.get('/api/flat', async (req, res) => {
	try {
		const { path } = req.query;
		const resolvedPath = DirectoryService.confirmPath(path as string);
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
		const fullPath = DirectoryService.confirmPath(relativePath as string);
		if (!fullPath) {
			res.status(404).send("File not found");
			return;
		}
		const probe = await ProbeService.getProbeData(fullPath);

		const parsedIndex = safeParseInt(index);
		if (!parsedIndex) {
			throw new Error('No valid index');
		}
		const subtitleStream = probe?.full.streams[parsedIndex];

		if (subtitleStream && (subtitleStream.codec_type === 'subtitle' || subtitleStream.tags?.handler_name === 'SubtitleHandler')) {
			if (subtitleStream.codec_name === 'mov_text' || subtitleStream.codec_name === 'subrip') {
				const subtitleIndex = subtitleStream.index;

				const origin = req.headers.origin as string | undefined;
				if (origin) {
					res.setHeader('Access-Control-Allow-Origin', origin);
					res.setHeader('Access-Control-Allow-Credentials', 'true');
					res.setHeader('Vary', 'Origin');
				}
				res.setHeader('Content-Type', 'text/vtt');

				useFfmpeg(async (ffmpeg, resolve, reject) => {
					const command = ffmpeg(fullPath.absolutePath)
						.outputOptions(`-map 0:${subtitleIndex}`)
						.outputOptions('-c:s webvtt')
						.format('webvtt');

					command.on('end', () => resolve());
					command.on('error', (err: any) => {
						console.error("Error while extracting subtitles:", err);
						if (!res.headersSent) {
							res.status(500).send("Error extracting subtitles");
						}
						reject(err);
					});

					command.pipe(res, { end: true });
				});

			}
			// else if (subtitleStream.codec_name === 'bin_data') {
			// 	// Log the binary data as text
			// 	// use ffmpeg to pass the data into a buffer and send it as text
			// 	const subtitleIndex = subtitleStream.index;
			// 	const outputFilePath = path.join(__dirname, '../dist/assets/output.txt');
			// 	useFfmpeg(async (ffmpeg, resolve, reject) => {
			// 		ffmpeg(fullPath.absolutePath)
			// 			.outputOptions(`-map 0:${subtitleIndex}`)
			// 			.outputOptions('-f srt') // Output format as SRT
			// 			.save(outputFilePath)
			// 			.on('end', () => {
			// 				const origin = req.headers.origin as string | undefined;
			// 				if (origin) {
			// 					res.setHeader('Access-Control-Allow-Origin', origin);
			// 					res.setHeader('Access-Control-Allow-Credentials', 'true');
			// 					res.setHeader('Vary', 'Origin');
			// 				}
			// 				res.setHeader('Content-Type', 'text/plain');
			// 				res.sendFile(outputFilePath, (err) => {
			// 					if (err) {
			// 						console.error("Error while sending subtitle file:", err);
			// 						res.status(500).send("Error sending subtitle file");
			// 					}
			// 				});
			// 			})
			// 			.on('error', (err: any) => {
			// 				console.error("Error while extracting subtitles:", err);
			// 				res.status(500).send("Error extracting subtitles");
			// 			});
			// 	});
			// }
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
	res.sendFile(DirectoryService.confirmPath(relativePath)!.absolutePath);
});
app.use('/api/thumb', (req, res) => {
	const relativePath = req.path;
	const { width, seek } = req.query;
	const resolvedPath = DirectoryService.confirmPath(relativePath);
	if (!resolvedPath) {
		res.status(404).send("File not found");
		return;
	}
	(async () => {
		// Gifs don't work if sharp resizes them, so just send he og file.
		// Consider using gif-encode in the future if gifs are too large and still need to be resized.
		if (resolvedPath.relativePath.endsWith('.gif')) {
			safeRes(res)?.sendFile(resolvedPath.absolutePath);
			return;
		}
		try {
			const thumbnailBuffer = await ThumbnailService.streamThumbnail(resolvedPath, safeParseInt(width), safeParseInt(seek));
			safeRes(res)?.setHeader('Content-Type', 'image/jpeg');
			safeRes(res)?.send(thumbnailBuffer);
		}
 catch (err: any) {
			console.error("Error while generating thumbnail for image:", relativePath);
			console.error(err.message);
			safeRes(res)?.status(500).send("Error generating thumbnail");
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

	// kick off library cache so users don't have to wait later
	LibraryService.getFlatTree(DirectoryService.confirmPath('/')!).catch(console.error)
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
