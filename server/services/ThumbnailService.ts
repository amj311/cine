import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { DirectoryService } from './DirectoryService';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const MAX_CACHE_SIZE = 100; // Maximum number of thumbnails to cache
const thumbCache = new Map<string, Buffer>();

export class ThumbnailService {
	/**
	 * Receives the path to a file, loads and shrinks the image with Shrp.js, and returns the result as a stream for the client to consume.
	 * @param relativePath 
	 */
	public static async streamThumbnail(relativePath: string, width: number = 300): Promise<Buffer> {
		try {
			const cachedThumbnail = ThumbnailService.getCachedThumbnail(relativePath, width);
			if (cachedThumbnail) {
				return cachedThumbnail;
			}


			const filePath = DirectoryService.resolvePath(relativePath);
			// Make sure the file is an image
			const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
			const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.3gp'];
			const audioExtensions = ['.mp3'];
			const isVideo = videoExtensions.includes(path.extname(filePath).toLowerCase());
			const isImage = imageExtensions.includes(path.extname(filePath).toLowerCase());
			const isAudio = audioExtensions.includes(path.extname(filePath).toLowerCase());

			if (!isImage && !isVideo && !isAudio) {
				throw new Error(`Thumb is not support for file: ${filePath}`);
			}

			let fileBuffer: Buffer = Buffer.from([]);
			if (isVideo) {
				// Use ffmpeg to get a frame from the video
				fileBuffer = await ThumbnailService.getVideoFrame(relativePath);
			}
			else if (isAudio) {
				// ffpeg can extract album art from mp3 files as a video stream
				fileBuffer = await ThumbnailService.getVideoFrame(relativePath, 0);
			}
			else {
				// Load the image file
				fileBuffer = await readFile(filePath);
			}
			let thumbnailBuffer: Buffer = Buffer.from([]);
			try {
				thumbnailBuffer = await ThumbnailService.resizeBuffer(fileBuffer, width);
			}
			catch (err) {
				console.log("Error while resizing image:", err.message);
				console.log("Attempting to fix JPEG file", filePath);
				const newBuffer = await ThumbnailService.attemptFixJpeg(fileBuffer);
				if (newBuffer) {
					thumbnailBuffer = await ThumbnailService.resizeBuffer(newBuffer, width);
				}
				else {
					throw new Error("Failed to fix JPEG file");
				}
			}
			ThumbnailService.cacheThumbnail(relativePath, width, thumbnailBuffer);
			return thumbnailBuffer;
		}
		catch (err) {
			console.error("Error while generating thumbnail for image:", relativePath);
			console.error(err.message);

			throw err;
		}

	}

	private static async resizeBuffer(buffer: Buffer, width: number) {
		return await sharp(buffer)
			.rotate()
			.resize(width, width, { fit: 'inside' })
			.toBuffer();
	}

	private static async attemptFixJpeg(buffer: Buffer) {
		// Attempt to fix the JPEG file by re-encoding it
		try {
			const fixedBuffer = await sharp(buffer, { failOn: 'none' })
				.jpeg()
				.rotate()
				.toBuffer()
			return fixedBuffer;
		} catch (err) {
			console.error("Error while fixing jpeg", err.message);
		}
	}

	/**
	 * Use ffmpeg to get frame from video
	 * @param relativePath
	 * @param buffer 
	 * @returns 
	 */
	private static async getVideoFrame(relativePath: string, seek: number = 2) {
		const filePath = DirectoryService.resolvePath(relativePath);
		return new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];

			ffmpeg(filePath)
				.on('error', (err) => {
					console.error("Error while processing video:", err.message);
					reject(err);
				})
				.outputOptions([
					`-ss ${seek || 0}`,        // Seek a bit into the video
					'-frames:v 1',  // Extract only one frame
					'-q:v 30',       // Set quality level
					'-f image2pipe' // Output as a pipe
				])
				.outputFormat('image2pipe') // Output format as image
				.pipe()
				.on('data', (chunk) => {
					chunks.push(chunk);
				})
				.on('end', () => {
					resolve(Buffer.concat(chunks));
				})
				.on('error', (err) => {
					console.error("Error while processing video:", err.message);
					reject(err);
				});
		});
	};

	private static cacheThumbnail(relativePath: string, width: number, buffer: Buffer) {
		if (width > 500) {
			// Don't cache thumbnails larger than this
			return;
		}
		thumbCache.set(relativePath + width, buffer);
		if (thumbCache.size > MAX_CACHE_SIZE) {
			const oldestKey = thumbCache.keys().next().value;
			thumbCache.delete(oldestKey);
		}
	}

	private static getCachedThumbnail(relativePath: string, width: number) {
		const cachedThumbnail = thumbCache.get(relativePath + width);
		if (cachedThumbnail) {
			return cachedThumbnail;
		}
		return null;
	}
}