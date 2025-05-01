import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { DirectoryService } from './DirectoryService';
import sharp from 'sharp';

export class ThumbnailService {
	/**
	 * Receives the path to a file, loads and shrinks the image with Shrp.js, and returns the result as a stream for the client to consume.
	 * @param relativePath 
	 */
	public static async streamThumbnail(relativePath: string, width: number = 300): Promise<Buffer> {
		const filePath = DirectoryService.resolvePath(relativePath);
		// Make sure the file is an image
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
		const fileExtension = path.extname(filePath).toLowerCase();
		if (!imageExtensions.includes(fileExtension)) {
			throw new Error(`File is not an image: ${filePath}`);
		}

		const fileBuffer = await readFile(filePath);
		const thumbnailBuffer = await sharp(fileBuffer)
			.rotate()
			.resize(width, width, { fit: 'inside' })
			.toBuffer();
		return thumbnailBuffer;
	}
}