import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';

/**
 * A unique identifier for every file/folder based on its path from MEDIA_DIR
 * RelativePaths will NOT start with '/'
 */
export type RelativePath = string & {
	__absolute: false;
};

/**
 * The absolute path of a file or directory on the server. Usually resolved from a RelativePath from MEDIA_DIR.
 * Guaranteed to exist!
 */
export type AbsolutePath = string & {
	__absolute: true;
};


export class ConfirmedPath {
	public relativePath: RelativePath;

	constructor(
		public absolutePath: AbsolutePath
	) {
		this.relativePath = DirectoryService.getRelativePath(absolutePath) as RelativePath;
	}

	append(newPath: string): ConfirmedPath {
		const newAbsolutePath = path.join(this.absolutePath, newPath) as AbsolutePath;
		return new ConfirmedPath(newAbsolutePath);
	}
	equals(other: string): boolean {
		return this.absolutePath === other;
	}
};

export class DirectoryService {
	/**
	 * Returns undefined if file does not exist
	 * @param anyPath 
	 * @returns 
	 */
	static resolvePath(anyPath: string): ConfirmedPath | undefined {
		const decodedPath = decodeURIComponent(anyPath);
		if (!process.env.MEDIA_DIR) {
			throw new Error('MEDIA_DIR environment variable is not set');
		}

		const MEDIA_DIR = process.env.MEDIA_DIR;
		const joinedPath = decodedPath.startsWith(MEDIA_DIR) ?
			decodedPath :
			path.join(MEDIA_DIR, decodedPath);

		// check if the path exists
		if (!existsSync(joinedPath)) {
			return undefined;
		}

		return new ConfirmedPath(joinedPath as AbsolutePath);
	}

	static async listDirectory(dirPath: ConfirmedPath) {
		try {
			const files = (await readdir(dirPath.absolutePath, { withFileTypes: true })).map((f) => {
				return {
					isDirectory: f.isDirectory(),
					name: f.name,
					confirmedPath: dirPath.append(f.name),
				};
			});
			const dirs = files.filter((file) => file.isDirectory);
			const filesOnly = files.filter((file) => !file.isDirectory);
			return { folders: dirs, files: filesOnly };
		}
		catch (err) {
			console.error("Error reading directory:", err, new Error().stack);
			return { folders: [], files: [] };
		}
	}

	public static getRelativePath(absolutePath: string): RelativePath {
		if (!process.env.MEDIA_DIR) {
			throw new Error('MEDIA_DIR environment variable is not set');
		}

		const MEDIA_DIR = process.env.MEDIA_DIR;
		if (!absolutePath.startsWith(MEDIA_DIR)) {
			throw new Error('Absolute path is not within MEDIA_DIR');
		}

		let finalPath = absolutePath.slice(MEDIA_DIR.length) as RelativePath;
		if (finalPath.startsWith('/')) {
			finalPath = finalPath.slice(1) as RelativePath;
		}
		return finalPath as RelativePath;
	}
}
