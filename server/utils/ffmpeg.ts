import { Stream } from "stream";
import { AbsolutePath } from "../services/DirectoryService";
import ffmpeg from 'fluent-ffmpeg';

type FfmpegSource = AbsolutePath | { source: Stream };

/**
 * Wraps ffmpeg in a promise. Receives only full absolute path to a file.
*/
export function useFfmpeg<T = any>(filePath: FfmpegSource, operation: (ffmpeg, resolve, reject) => void) {
	return new Promise<T>((resolve, reject) => {
		try {
			operation(ffmpeg(filePath), resolve, reject);
		} catch (err) {
			console.error("Error while using ffmpeg:", err);
			reject(err);
		}
	})
}