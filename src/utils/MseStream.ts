import { useApiStore } from '@/stores/api.store';
import { encodeMediaPath } from '@/utils/miscUtils';

/**
 * When fewer than this many seconds remain in the current buffered region,
 * begin fetching the next chunk.
 */
const PREFETCH_THRESHOLD_S = 10;

/**
 * How many seconds behind currentTime to keep in the SourceBuffer.
 * Everything older than (currentTime − KEEP_BEHIND_S) is evicted.
 */
const KEEP_BEHIND_S = 60;

interface ChunkEntry { start: number; end: number; }

interface MseProbeResult {
	duration: number;
	mimeType: string;
	chunks: ChunkEntry[];
}

/**
 * MseStream — MSE-based chunk streamer for server-side media files.
 *
 * Usage:
 *   const stream = new MseStream(videoElement, '/path/to/file.mkv');
 *   await stream.init();   // attaches MediaSource and starts buffering
 *   // ... later ...
 *   stream.destroy();      // clean up on unmount
 *
 * The class attaches itself to the provided HTMLVideoElement by setting its
 * `src` to a blob URL backed by a MediaSource.  All native videoEl properties
 * and event listeners (currentTime, duration, seeking, ended, …) continue to
 * work exactly as they would with a normal URL-sourced element.
 *
 * The server transcodes each time-bounded chunk to fragmented MP4 (fMP4) on
 * the fly, so any file format that ffmpeg can read is supported — the client
 * only ever receives fMP4 regardless of the source container.
 *
 * Chunk boundaries: the server pre-computes a keyframe-aligned chunk index
 * (/mse/index) which lists exact {start, end} timestamps derived from real
 * keyframes in the container. The client fetches this index once at init and
 * uses it to request each chunk by index position, completely avoiding the
 * unreliable sourceBuffer.buffered.end() heuristic.
 */
export class MseStream {
	private mediaSource: MediaSource;
	private sourceBuffer: SourceBuffer | null = null;
	private readonly videoEl: HTMLVideoElement;
	private readonly relativePath: string;
	private readonly audioStreamIndex: number | undefined;
	private isFetching: boolean = false;

	private duration: number = 0;
	private destroyed: boolean = false;

	/** Server-generated keyframe-aligned chunk index. */
	private chunkIndex: ChunkEntry[] = [];

	/** AbortController for any in-flight chunk fetch. */
	private fetchController: AbortController | null = null;

	/**
	 * Set while a seek is being processed. Blocks maybePreloadNext and
	 * prevents concurrent seek handlers from interleaving.
	 */
	private seekingInProgress: boolean = false;

	/**
	 * If a second seek arrives while seekingInProgress is true, its target is
	 * stored here and processed once the current seek completes.
	 */
	private pendingSeekTime: number | null = null;

	/** Guards against overlapping cleanOldBuffers calls. */
	private cleanupInProgress: boolean = false;

	/** Timestamp (ms) of the last maybePreloadNext evaluation, to throttle timeupdate calls. */
	private lastPreloadCheck: number = 0;
	private readonly PRELOAD_COOLDOWN_MS = 5000;

	constructor(videoEl: HTMLVideoElement, relativePath: string, audioStreamIndex?: number) {
		this.videoEl = videoEl;
		this.relativePath = relativePath;
		this.audioStreamIndex = audioStreamIndex;
		this.mediaSource = new MediaSource();
	}

	// ─── Public API ─────────────────────────────────────────────

	/**
	 * Probe the file, fetch the chunk index, attach MediaSource to the video
	 * element, create the SourceBuffer, and load the first chunk.
	 */
	async init(): Promise<void> {
		const api = useApiStore().api;
		const params: Record<string, any> = { path: this.relativePath };
		if (this.audioStreamIndex !== undefined) params.audioIndex = this.audioStreamIndex;
		const { data } = await api.get<MseProbeResult>('/mse/probe', { params });

		if (this.destroyed) return;

		this.duration = data.duration;
		this.chunkIndex = data.chunks;

		// Attach MediaSource — sets videoEl.src to a blob: URL
		const objectUrl = URL.createObjectURL(this.mediaSource);
		this.videoEl.src = objectUrl;

		await new Promise<void>((resolve) => {
			this.mediaSource.addEventListener('sourceopen', () => resolve(), { once: true });
		});

		if (this.destroyed) return;

		this.mediaSource.duration = this.duration;

		if (!MediaSource.isTypeSupported(data.mimeType)) {
			console.warn('[MseStream] Browser does not support MIME type:', data.mimeType);
		}

		this.sourceBuffer = this.mediaSource.addSourceBuffer(data.mimeType);
		this.sourceBuffer.mode = 'segments';

		this.videoEl.addEventListener('seeking', this.onSeeking);
		this.videoEl.addEventListener('timeupdate', this.onTimeUpdate);

		// Load whichever chunk covers the current playback position (e.g. a
		// resume offset may have been applied before init() completed).
		const initialTime = this.videoEl.currentTime || 0;
		const startIdx = this.findChunkIdxForTime(initialTime);

		// TEST load first two chunks immediately and see if they play well together in the buffer
		await this.fetchAndAppendChunk(startIdx);
	}

	/** Release all resources — call in component onBeforeUnmount. */
	destroy(): void {
		this.destroyed = true;
		this.cancelFetch();
		this.videoEl.removeEventListener('seeking', this.onSeeking);
		this.videoEl.removeEventListener('timeupdate', this.onTimeUpdate);

		const blobUrl = this.videoEl.src;
		this.videoEl.src = '';

		try {
			if (this.mediaSource.readyState === 'open') {
				this.mediaSource.endOfStream();
			}
		} catch (_) { }

		URL.revokeObjectURL(blobUrl);
	}

	// ─── Event handlers ────────────────────────────────────────────────────

	private onTimeUpdate = (): void => {
		this.maybePreloadNext();
	};

	private onSeeking = async (): Promise<void> => {
		if (this.destroyed) return;

		// If already handling a seek, store the latest target and let the
		// in-progress handler pick it up when it finishes.
		if (this.seekingInProgress) {
			this.pendingSeekTime = this.videoEl.currentTime;
			return;
		}

		await this.handleSeek(this.videoEl.currentTime);
	};


	// ─── Seek handling ─────────────────────────────────────────────────────

	private async handleSeek(seekTime: number): Promise<void> {
		// this.seekingInProgress = true;
		// try {
		// 	// If seekTime is already buffered, update the chunk cursor and make
		// 	// sure the next chunk is queued; no need to re-fetch.
		// 	if (this.isTimeBuffered(seekTime)) {
		// 		this.nextChunkIdx = this.findChunkIdxForTime(seekTime) + 1;
		// 		this.maybePreloadNext();
		// 		return;
		// 	}

		// 	this.cancelFetch();
		// 	await this.clearBuffers();
		// 	if (this.destroyed) return;

		// 	const chunkIdx = this.findChunkIdxForTime(seekTime);
		// 	await this.fetchAndAppendChunk(chunkIdx);
		// } finally {
		// 	this.seekingInProgress = false;
		// 	// Handle any seek that arrived while we were busy
		// 	if (this.pendingSeekTime !== null && !this.destroyed) {
		// 		const pending = this.pendingSeekTime;
		// 		this.pendingSeekTime = null;
		// 		await this.handleSeek(pending);
		// 	}
		// }
	}

	// ─── Buffering logic ────────────────────────────────────────────────────

	/**
	 * Returns the index of the chunk whose range contains `time`. Falls back
	 * to the last chunk if time is past the end.
	 */
	private findChunkIdxForTime(time: number): number {
		for (let i = 0; i < this.chunkIndex.length; i++) {
			if (time < this.chunkIndex[i].end) return i;
		}
		return Math.max(0, this.chunkIndex.length - 1);
	}

	/**
	 * Returns true if `time` is well inside a buffered range — at least 1s
	 * of runway remaining so playback won't immediately stall at the edge.
	 */
	private isTimeBuffered(time: number): boolean {
		const { buffered } = this.videoEl;
		for (let i = 0; i < buffered.length; i++) {
			if (time >= buffered.start(i) && time < buffered.end(i) - 1) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Returns the furthest buffered end contiguous with currentTime.
	 * Used only for the prefetch threshold check.
	 */
	private getBufferedEnd(): number {
		const { currentTime, buffered } = this.videoEl;
		let furthest = currentTime;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered.start(i) <= currentTime + 1 && buffered.end(i) > furthest) {
				furthest = buffered.end(i);
			}
		}
		return furthest;
	}

	/**
	 * If playback is close to the end of buffered data, fetch the next chunk
	 * from the server-generated index. The index guarantees chunk boundaries
	 * are real keyframe timestamps, so there is no overlap and no gap.
	 */
	private maybePreloadNext(): void {
		if (this.destroyed) return;
		if (this.isFetching || this.seekingInProgress || !this.sourceBuffer) return;

		const now = Date.now();
		if (now - this.lastPreloadCheck < this.PRELOAD_COOLDOWN_MS) return;
		this.lastPreloadCheck = now;

		const currentChunkIdx = this.findChunkIdxForTime(this.videoEl.currentTime);
		const currentChunk = this.chunkIndex[currentChunkIdx];
		if (!currentChunk) return;

		const nextChunkIdx = currentChunkIdx + 1;
		if (nextChunkIdx >= this.chunkIndex.length) return;

		// Skip if the next chunk is already in the buffer
		const nextChunkStart = this.chunkIndex[nextChunkIdx].start;
		if (this.isTimeBuffered(nextChunkStart + 1)) return;

		const timeUntilChunkEnd = currentChunk.end - this.videoEl.currentTime;
		if (timeUntilChunkEnd < PREFETCH_THRESHOLD_S) {
			this.fetchAndAppendChunk(nextChunkIdx).catch(console.error);
		}
	}

	// ─── Chunk fetching ──────────────────────────────────────────────────────

	private async fetchAndAppendChunk(chunkIdx: number): Promise<void> {
		if (this.destroyed || !this.sourceBuffer) return;

		if (chunkIdx >= this.chunkIndex.length) {
			this.signalEndOfStream();
			return;
		}

		if (this.isFetching) return;

		const { start: startSec, end: endSec } = this.chunkIndex[chunkIdx];

		this.isFetching = true;
		const controller = new AbortController();
		this.fetchController = controller;

		const apiUrl = useApiStore().apiUrl;
		let url = `${apiUrl}/mse/chunk?path=${encodeMediaPath(this.relativePath)}&start=${startSec + 0.2}&end=${endSec}`;
		if (this.audioStreamIndex !== undefined) url += `&audioIndex=${this.audioStreamIndex}`;

		try {
			const response = await fetch(url, {
				signal: controller.signal,
				credentials: 'include',
			});

			if (!response.ok) {
				console.error('[MseStream] Chunk fetch failed with status', response.status);
				this.fetchController = null;
				this.isFetching = false;
				return;
			}

			const buffer = await response.arrayBuffer();

			if (controller.signal.aborted || this.destroyed) return;

			this.fetchController = null;

			// Place the chunk at the correct position in the MSE timeline.
			// ffmpeg produces 0-based timestamps; timestampOffset shifts them.
			this.sourceBuffer!.timestampOffset = startSec;

			await this.appendToSourceBuffer(buffer);

			if (this.destroyed) return;

			// Signal EOS when this was the last chunk
			if (chunkIdx + 1 >= this.chunkIndex.length) {
				this.signalEndOfStream();
			}

			this.isFetching = false;
			await this.cleanOldBuffers();
		} catch (err: any) {
			this.isFetching = false;
			if (err?.name === 'AbortError') return;
			console.error('[MseStream] Chunk fetch error:', err);
		}
	}

	// ─── SourceBuffer helpers ───────────────────────────────────────────────

	private async appendToSourceBuffer(buffer: ArrayBuffer): Promise<void> {
		if (!this.sourceBuffer || this.destroyed) return;
		await this.waitForSourceBuffer();
		if (this.destroyed) return;
		return new Promise<void>((resolve, reject) => {
			const onEnd = () => {
				this.sourceBuffer!.removeEventListener('updateend', onEnd);
				this.sourceBuffer!.removeEventListener('error', onErr);
				resolve();
			};
			const onErr = (e: Event) => {
				this.sourceBuffer!.removeEventListener('updateend', onEnd);
				this.sourceBuffer!.removeEventListener('error', onErr);
				reject(e);
			};
			this.sourceBuffer!.addEventListener('updateend', onEnd);
			this.sourceBuffer!.addEventListener('error', onErr);
			try {
				this.sourceBuffer!.appendBuffer(buffer);
			} catch (e) {
				this.sourceBuffer!.removeEventListener('updateend', onEnd);
				this.sourceBuffer!.removeEventListener('error', onErr);
				reject(e);
			}
		});
	}

	/** Remove all buffered data (used before loading a seek position). */
	private async clearBuffers(): Promise<void> {
		if (!this.sourceBuffer) return;
		await this.waitForSourceBuffer();
		if (this.sourceBuffer.buffered.length === 0) return;
		return new Promise<void>((resolve) => {
			const onEnd = () => {
				this.sourceBuffer!.removeEventListener('updateend', onEnd);
				resolve();
			};
			this.sourceBuffer!.addEventListener('updateend', onEnd);
			this.sourceBuffer!.remove(0, this.duration + 1);
		});
	}

	/** Evict data that is far enough behind currentTime to free memory. */
	private cleanOldBuffers(): void {
		if (this.cleanupInProgress || !this.sourceBuffer || this.sourceBuffer.updating) return;
		const removeEnd = Math.max(0, this.videoEl.currentTime - KEEP_BEHIND_S);
		const { buffered } = this.sourceBuffer;
		if (buffered.length === 0 || buffered.start(0) >= removeEnd) return;

		this.cleanupInProgress = true;
		this.waitForSourceBuffer().then(() => {
			if (!this.sourceBuffer || this.destroyed) return;
			const start = this.sourceBuffer.buffered.start(0);
			if (start >= removeEnd) return;
			return new Promise<void>((resolve) => {
				const onEnd = () => {
					this.sourceBuffer!.removeEventListener('updateend', onEnd);
					resolve();
				};
				this.sourceBuffer!.addEventListener('updateend', onEnd);
				this.sourceBuffer!.remove(start, removeEnd);
			});
		}).catch(() => {
			// Cleanup is non-critical; silently ignore errors
		}).finally(() => {
			this.cleanupInProgress = false;
		});
	}

	/** Wait until the SourceBuffer is not updating before proceeding. */
	private waitForSourceBuffer(): Promise<void> {
		if (!this.sourceBuffer?.updating) return Promise.resolve();
		return new Promise<void>((resolve) => {
			this.sourceBuffer!.addEventListener('updateend', () => resolve(), { once: true });
		});
	}

	private cancelFetch(): void {
		if (this.fetchController) {
			this.fetchController.abort();
			this.fetchController = null;
		}
		this.isFetching = false;
	}

	private signalEndOfStream(): void {
		try {
			if (this.mediaSource.readyState === 'open' && !this.sourceBuffer?.updating) {
				this.mediaSource.endOfStream();
			}
		} catch (_) { }
	}
}

