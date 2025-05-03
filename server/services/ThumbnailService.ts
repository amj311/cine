import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { DirectoryService } from './DirectoryService';
import sharp from 'sharp';

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
			const fileExtension = path.extname(filePath).toLowerCase();
			if (!imageExtensions.includes(fileExtension)) {
				throw new Error(`File is not an image: ${filePath}`);
			}

			const fileBuffer = await readFile(filePath);
			let thumbnailBuffer: Buffer = Buffer.from([]);
			try {
				thumbnailBuffer = await ThumbnailService.resizeBuffer(fileBuffer, width);
			}
			catch (err) {
				console.log("Error while resizing image:", err.message);
				if (err.message.includes("SOS parameters for sequential JPEG")) {
					console.log("Attempting to fix JPEG file", filePath);
					const newBuffer = await ThumbnailService.attemptFixJpeg(fileBuffer);
					if (newBuffer) {
						thumbnailBuffer = await ThumbnailService.resizeBuffer(newBuffer, width);
					}
					else {
						throw new Error("Failed to fix JPEG file");
					}
				}
				else {
					console.log("Error was not related to JPEG, throwing");
					throw err;
				};
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
				.toFormat('png')
				.toBuffer()
			return fixedBuffer;
		} catch (err) {
			console.error("Error while fixing jpeg", err.message);
		}
	}

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