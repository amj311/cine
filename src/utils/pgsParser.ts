/**
 * PGS (Presentation Graphics Stream / HDMV) subtitle parser.
 *
 * Ports FFmpeg libavcodec/pgssubdec.c to TypeScript.
 *
 * A PGS subtitle stream is stored in a .sup file as a series of packets,
 * each with a 13-byte header:
 *   [0-1]   magic "PG" = 0x50 0x47
 *   [2-5]   PTS (90 kHz clock, big-endian uint32)
 *   [6-9]   DTS (ignored)
 *   [10]    segment type
 *   [11-12] segment data length N
 *   [13..]  segment data
 *
 * Segments are grouped into Display Sets, each starting with a PCS and
 * ending with an END segment. One display set = one subtitle "frame".
 *
 * Segment types:
 *   0x14  PDS — Palette Definition Segment  (256-entry YCrCbA CLUT)
 *   0x15  ODS — Object Definition Segment   (RLE-encoded bitmap)
 *   0x16  PCS — Presentation Composition Segment (timing + layout)
 *   0x17  WDS — Window Definition Segment   (ignored)
 *   0x80  END — End of display set
 *
 * Epoch model (from PGS spec / FFmpeg):
 *   Objects and palettes persist across display sets within an "epoch".
 *   A new epoch (state != 0x00 in PCS) flushes all cached objects and
 *   palettes. PgsDecoder maintains this state between calls.
 *
 * Reference: FFmpeg libavcodec/pgssubdec.c, libavutil/colorspace.h
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PgsBitmap {
	/** X position of the object within the video frame. */
	x: number;
	/** Y position of the object within the video frame. */
	y: number;
	width: number;
	height: number;
	/** Video frame width from the PCS (used to size the canvas). */
	videoWidth: number;
	/** Video frame height from the PCS (used to size the canvas). */
	videoHeight: number;
	/** True when the display set contains no objects (clear-screen event). */
	isEmpty: boolean;
	/** Canvas-ready RGBA bitmap, null when isEmpty is true. */
	imageData: ImageData | null;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PgsObject {
	w: number;
	h: number;
	/** Raw RLE buffer (pre-allocated to expected size). */
	rle: Uint8Array;
	/** Number of RLE bytes written so far (may grow across ODS fragments). */
	rleLen: number;
	/** Total expected RLE bytes (from ODS first-fragment header). */
	rleExpected: number;
}

interface PgsPalette {
	/**
	 * 256 RGBA values as little-endian uint32 (byte order: R, G, B, A).
	 * Matches the memory layout expected by ImageData via a Uint8ClampedArray
	 * view — each uint32 stores one pixel as 0xAABBGGRR in memory.
	 */
	clut: Uint32Array;
}

interface PcsObjectRef {
	id: number;
	x: number;
	y: number;
	/** Raw composition flags byte (bit 7 = crop, bit 6 = forced). */
	compositionFlag: number;
}

interface PcsResult {
	videoWidth: number;
	videoHeight: number;
	paletteId: number;
	/**
	 * Epoch state from PCS bits 7–6:
	 *   0 = Normal (objects/palettes still valid)
	 *   1 = Acquisition point
	 *   2 = Epoch start  → flush cache
	 *   3 = Epoch continue → flush cache
	 */
	state: number;
	isEmpty: boolean;
	objects: PcsObjectRef[];
}

// ---------------------------------------------------------------------------
// Segment type constants
// ---------------------------------------------------------------------------

const SEG_PDS = 0x14;
const SEG_ODS = 0x15;
const SEG_PCS = 0x16;
// SEG_WDS = 0x17 is intentionally ignored
const SEG_END = 0x80;

const PACKET_HEADER_SIZE = 13;

// ---------------------------------------------------------------------------
// YCrCb → RGBA conversion  (mirrors FFmpeg libavutil/colorspace.h)
//
// PGS palettes are stored as limited-range YCrCb (CCIR / studio swing):
//   Y  in [16, 235], Cr/Cb in [16, 240]
//
// Colorspace selection (same heuristic as FFmpeg pgssubdec.c):
//   height > 576 → BT.709 (Blu-ray HD)
//   height ≤ 576 → BT.601 (SD / DVD)
// ---------------------------------------------------------------------------

const SCALEBITS = 10;
const ONE_HALF = 1 << (SCALEBITS - 1); // 512

function fix(x: number): number {
	return Math.round(x * (1 << SCALEBITS));
}

// BT.709 coefficients
const BT709_R_CR = fix(1.5747 * 255.0 / 224.0);  // ≈ 1835
const BT709_G_CB = fix(0.1873 * 255.0 / 224.0);  // ≈  218
const BT709_G_CR = fix(0.4682 * 255.0 / 224.0);  // ≈  546
const BT709_B_CB = fix(1.8556 * 255.0 / 224.0);  // ≈ 2163

// BT.601 coefficients
const BT601_R_CR = fix(1.40200 * 255.0 / 224.0); // ≈ 1634
const BT601_G_CB = fix(0.34414 * 255.0 / 224.0); // ≈  401
const BT601_G_CR = fix(0.71414 * 255.0 / 224.0); // ≈  832
const BT601_B_CB = fix(1.77200 * 255.0 / 224.0); // ≈ 2065

// Y luma scale: (Y - 16) × FIX(255/219)
const Y_SCALE = fix(255.0 / 219.0); // ≈ 1192

function clip8(v: number): number {
	return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Convert one YCrCb + alpha entry to a packed little-endian RGBA uint32
 * suitable for writing into a Uint32Array view of a Uint8ClampedArray
 * (i.e. the backing store of an ImageData).
 *
 * Memory byte order on little-endian: [R, G, B, A].
 */
function ycrCbToRgba(Y: number, Cr: number, Cb: number, alpha: number, useBt709: boolean): number {
	const y = (Y - 16) * Y_SCALE;
	const cb = Cb - 128;
	const cr = Cr - 128;

	let r_add: number, g_add: number, b_add: number;

	if (useBt709) {
		r_add = ONE_HALF + BT709_R_CR * cr;
		g_add = ONE_HALF - BT709_G_CB * cb - BT709_G_CR * cr;
		b_add = ONE_HALF + BT709_B_CB * cb;
	} else {
		r_add = ONE_HALF + BT601_R_CR * cr;
		g_add = ONE_HALF - BT601_G_CB * cb - BT601_G_CR * cr;
		b_add = ONE_HALF + BT601_B_CB * cb;
	}

	const r = clip8((y + r_add) >> SCALEBITS);
	const g = clip8((y + g_add) >> SCALEBITS);
	const b = clip8((y + b_add) >> SCALEBITS);

	// Pack as little-endian RGBA: lowest byte = R, highest byte = A
	return (alpha << 24) | (b << 16) | (g << 8) | r;
}

// ---------------------------------------------------------------------------
// PgsDecoder
// ---------------------------------------------------------------------------

/**
 * Stateful PGS display-set decoder.
 *
 * One instance should be created per subtitle track and reused across
 * sequential display-set fetches so that epoch-level palette and object
 * caches are maintained correctly.
 *
 * Call reset() when the user seeks backward — the first display set after
 * the seek may miss epoch-inherited state, but subsequent ones will be fine.
 * In practice, most Blu-ray PGS tracks are self-contained per display set.
 */
export class PgsDecoder {
	private objects = new Map<number, PgsObject>();
	private palettes = new Map<number, PgsPalette>();

	/** Flush all cached objects and palettes (call on backward seek). */
	reset(): void {
		this.objects.clear();
		this.palettes.clear();
	}

	/**
	 * Parse one display set and return a renderable bitmap (or an isEmpty
	 * marker for clear-screen events).
	 *
	 * @param data    Raw .sup bytes for the display set, starting at the PCS
	 *                packet (13-byte header included) through the END packet.
	 * @param pts_ms  Presentation timestamp in milliseconds (from the index).
	 */
	parseDisplaySet(data: Uint8Array, pts_ms: number): PgsBitmap | null {
		let presentation: PcsResult | null = null;
		let i = 0;

		while (i + PACKET_HEADER_SIZE <= data.length) {
			// Verify magic "PG"
			if (data[i] !== 0x50 || data[i + 1] !== 0x47) break;

			const type = data[i + 10];
			const segLen = (data[i + 11] << 8) | data[i + 12];
			const seg = data.subarray(i + PACKET_HEADER_SIZE, i + PACKET_HEADER_SIZE + segLen);
			i += PACKET_HEADER_SIZE + segLen;

			switch (type) {
				case SEG_PCS: {
					presentation = this.parsePcs(seg);
					if (presentation && presentation.state !== 0) {
						// Epoch boundary — previous objects/palettes are no longer valid
						this.objects.clear();
						this.palettes.clear();
					}
					break;
				}
				case SEG_PDS: {
					// We need videoHeight to pick the right colorspace;
					// PCS always precedes PDS in a well-formed display set.
					const useBt709 = (presentation?.videoHeight ?? 1080) > 576;
					this.parsePds(seg, useBt709);
					break;
				}
				case SEG_ODS:
					this.parseOds(seg);
					break;
				case SEG_END:
					break; // nothing to do
			}
		}

		if (!presentation) return null;

		if (presentation.isEmpty || presentation.objects.length === 0) {
			return {
				x: 0, y: 0, width: 0, height: 0,
				videoWidth: presentation.videoWidth,
				videoHeight: presentation.videoHeight,
				isEmpty: true, imageData: null,
			};
		}

		const pal = this.palettes.get(presentation.paletteId);
		if (!pal) return null;

		// Render all composition objects.  Most display sets have only one;
		// the spec allows up to two.  We render each independently and return
		// the first that succeeds (multi-object layout is rare in practice).
		for (const ref of presentation.objects) {
			const obj = this.objects.get(ref.id);
			if (!obj || obj.rleLen === 0) continue;

			const imageData = this.decodeRle(obj.rle, obj.rleLen, obj.w, obj.h, pal);
			if (!imageData) continue;

			return {
				x: ref.x, y: ref.y,
				width: obj.w, height: obj.h,
				videoWidth: presentation.videoWidth,
				videoHeight: presentation.videoHeight,
				isEmpty: false, imageData,
			};
		}

		return null;
	}

	// ---------------------------------------------------------------------------
	// PCS — Presentation Composition Segment
	// ---------------------------------------------------------------------------

	private parsePcs(seg: Uint8Array): PcsResult | null {
		// [0-1]  video width
		// [2-3]  video height
		// [4]    frame rate (skip)
		// [5-6]  composition number
		// [7]    state (bits 7-6) + reserved
		// [8]    palette_update_flag (bit 7) + reserved
		// [9]    palette ID
		// [10]   object count
		// [11..] object refs
		if (seg.length < 11) return null;

		const videoWidth = (seg[0] << 8) | seg[1];
		const videoHeight = (seg[2] << 8) | seg[3];
		const state = (seg[7] >> 6) & 0x03;
		const paletteId = seg[9];
		const objectCount = seg[10];

		const objects: PcsObjectRef[] = [];
		let off = 11;

		for (let o = 0; o < objectCount; o++) {
			if (off + 8 > seg.length) break;

			const id = (seg[off] << 8) | seg[off + 1];
			// seg[off + 2] = window_id  (skip)
			const compositionFlag = seg[off + 3];
			const x = (seg[off + 4] << 8) | seg[off + 5];
			const y = (seg[off + 6] << 8) | seg[off + 7];
			off += 8;

			// Optional crop data (bit 7 of compositionFlag)
			if (compositionFlag & 0x80) off += 8;

			objects.push({ id, x, y, compositionFlag });
		}

		return { videoWidth, videoHeight, paletteId, state, isEmpty: objectCount === 0, objects };
	}

	// ---------------------------------------------------------------------------
	// PDS — Palette Definition Segment
	// ---------------------------------------------------------------------------

	private parsePds(seg: Uint8Array, useBt709: boolean): void {
		// [0]    palette ID
		// [1]    palette version (skip — we overwrite entries)
		// [2..]  5-byte entries repeated: colorId, Y, Cr, Cb, alpha
		if (seg.length < 2) return;

		const id = seg[0];
		let pal = this.palettes.get(id);
		if (!pal) {
			pal = { clut: new Uint32Array(256) };
			this.palettes.set(id, pal);
		}

		let off = 2;
		while (off + 5 <= seg.length) {
			const colorId = seg[off];
			const Y = seg[off + 1];
			const Cr = seg[off + 2];
			const Cb = seg[off + 3];
			const alpha = seg[off + 4];
			pal.clut[colorId] = ycrCbToRgba(Y, Cr, Cb, alpha, useBt709);
			off += 5;
		}
	}

	// ---------------------------------------------------------------------------
	// ODS — Object Definition Segment
	// ---------------------------------------------------------------------------

	private parseOds(seg: Uint8Array): void {
		// [0-1]  object ID
		// [2]    object version (skip)
		// [3]    sequence flags  (bit 7 = first fragment, bit 6 = last fragment)
		//
		// If first fragment:
		//   [4-6]  total RLE length as uint24 BE (includes the 4 bytes below)
		//   [7-8]  width
		//   [9-10] height
		//   [11..] first RLE data chunk
		//
		// If continuation:
		//   [4..]  additional RLE bytes (appended to object's rle buffer)
		if (seg.length < 4) return;

		const id = (seg[0] << 8) | seg[1];
		const seqFlags = seg[3];
		const isFirst = (seqFlags & 0x80) !== 0;

		if (isFirst) {
			if (seg.length < 11) return;

			// Stored length includes the 4 bytes for width + height
			const rleTotalLen = ((seg[4] << 16) | (seg[5] << 8) | seg[6]) - 4;
			const width = (seg[7] << 8) | seg[8];
			const height = (seg[9] << 8) | seg[10];

			if (width === 0 || height === 0 || rleTotalLen <= 0) return;

			const obj: PgsObject = {
				w: width, h: height,
				rle: new Uint8Array(rleTotalLen),
				rleLen: 0,
				rleExpected: rleTotalLen,
			};

			const chunk = seg.subarray(11);
			const copyLen = Math.min(chunk.length, rleTotalLen);
			obj.rle.set(chunk.subarray(0, copyLen));
			obj.rleLen = copyLen;

			this.objects.set(id, obj);
		} else {
			const obj = this.objects.get(id);
			if (!obj) return;

			const chunk = seg.subarray(4);
			const remaining = obj.rleExpected - obj.rleLen;
			const copyLen = Math.min(chunk.length, remaining);
			obj.rle.set(chunk.subarray(0, copyLen), obj.rleLen);
			obj.rleLen += copyLen;
		}
	}

	// ---------------------------------------------------------------------------
	// RLE decode  (ports FFmpeg libavcodec/pgssubdec.c decode_rle)
	// ---------------------------------------------------------------------------

	/**
	 * Decode a PGS RLE bitmap into an RGBA ImageData.
	 *
	 * The RLE encoding is byte-oriented and row-sequential (no interlacing):
	 *   - Non-zero byte → emit 1 pixel of that palette index.
	 *   - Zero byte → read flags byte:
	 *       run  = flags & 0x3F
	 *       if flags & 0x40: run = (run << 8) | next_byte  (14-bit run)
	 *       color = (flags & 0x80) ? next_byte : 0
	 *       if run == 0: end of line
	 *       else: emit `run` pixels of `color`
	 */
	private decodeRle(
		rle: Uint8Array,
		rleLen: number,
		width: number,
		height: number,
		pal: PgsPalette,
	): ImageData | null {
		const pixels = new Uint8ClampedArray(width * height * 4);
		const view32 = new Uint32Array(pixels.buffer);

		let pixelCount = 0;
		let lineCount = 0;
		let i = 0;

		while (i < rleLen && lineCount < height) {
			let color = rle[i++];
			let run = 1;

			if (color === 0x00) {
				if (i >= rleLen) break;
				const flags = rle[i++];
				run = flags & 0x3F;

				if (flags & 0x40) {
					if (i >= rleLen) break;
					run = (run << 8) | rle[i++];
				}

				color = (flags & 0x80)
					? (i < rleLen ? rle[i++] : 0)
					: 0;

				if (run === 0) {
					// End-of-line marker
					lineCount++;
					continue;
				}
			}

			if (run > 0 && pixelCount + run <= width * height) {
				view32.fill(pal.clut[color], pixelCount, pixelCount + run);
				pixelCount += run;
			}
		}

		return new ImageData(pixels, width, height);
	}
}
