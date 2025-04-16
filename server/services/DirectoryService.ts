import { readdir } from 'fs/promises';
import path from 'path';

/**
 * A unique identifier for every file/folder based on its path from MEDIA_DIR
 */
export type RelativePath = string;
/**
 * The absolute path of a file or directory on the server. Usually resolved from a RelativePath from MEDIA_DIR.
 */
export type AbsolutePath = `/${string}`;

export class DirectoryService {
	static resolvePath(relativePath: RelativePath): AbsolutePath {
		if (!process.env.MEDIA_DIR) {
			throw new Error('MEDIA_DIR environment variable is not set');
		}

		const MEDIA_DIR = process.env.MEDIA_DIR;
		if (relativePath.includes(MEDIA_DIR)) {
			return relativePath as AbsolutePath;
		}
		return path.join(MEDIA_DIR, relativePath) as AbsolutePath;
	}

	static async listDirectory(path: string) {
		const resolvedPath = DirectoryService.resolvePath(path);
		const files = await readdir(resolvedPath, { withFileTypes: true });
		const dirs = files.filter((file) => file.isDirectory()).map((file) => file.name);
		const filesOnly = files.filter((file) => !file.isDirectory()).map((file) => file.name);
		return { folders: dirs, files: filesOnly };
	}
}