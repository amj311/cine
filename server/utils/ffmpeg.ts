import Ffmpeg from "fluent-ffmpeg";
import { PromiseQueue } from "./PromiseQueue";
const FfmpegQueue = new PromiseQueue();

/**
 * Wraps ffmpeg in a promise. Receives only full absolute path to a file.
*/
export async function useFfmpeg<T = void>(operation: (ffmpeg: typeof Ffmpeg, resolve: (value: T | PromiseLike<T>) => void, reject: (err: Error) => any) => void) {
	return new Promise<T>(async (resolve, reject) => {
		try {
			// console.log("Adding ffmpeg operation to queue", FfmpegQueue.size + 1);
			await FfmpegQueue.add(async () => {
				// console.log("started op");
				operation(Ffmpeg, resolve, reject);
			});
			// console.log("Finished ffmpeg operation", FfmpegQueue.size);
		} catch (err) {
			console.error("Error while using ffmpeg:", err);
			reject(err);
		}
	})
}