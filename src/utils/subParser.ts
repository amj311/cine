/**
 * Parser for VobSub .sub subtitle bitmap packets.
 *
 * Based on VLC's MPEG-2 PS demuxer (modules/demux/vobsub.c) and
 * SPU codec (modules/codec/spudec/parse.c).
 *
 * A .sub file is a raw MPEG-2 Program Stream containing private_stream_1
 * (0xBD) PES packets that carry DVD SPU data. Each subtitle occupies one
 * or more consecutive PES packets starting at the byte offset listed in the
 * paired .idx file. The server slices out that byte range and sends it here.
 *
 * Pipeline:
 *   Uint8Array (raw .sub chunk)  +  RgbColor[16] (palette from .idx)
 *     → reassembleSpu   — strips MPEG-2 PS/PES headers, collects SPU payload
 *     → parseControlSeq — walks command bytes: timing, coords, palette indices
 *     → parseRle        — decodes 2bpp interlaced nibble RLE → run-length codes
 *     → render          — expands runs into RGBA ImageData (canvas-ready)
 */

import type { RgbColor } from '../../server/utils/idxParser';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpuBitmap {
	/** Horizontal offset into the original video frame. */
	x: number;
	/** Vertical offset into the original video frame. */
	y: number;
	width: number;
	height: number;
	/**
	 * Absolute display-start in milliseconds, derived from the PTS embedded
	 * in the PES packet plus the SPU START_DISPLAY command date.
	 * null when no START_DISPLAY command was found (rare/corrupt packets).
	 */
	startMs: number | null;
	/**
	 * Absolute display-stop in milliseconds from the SPU STOP_DISPLAY command.
	 * null when absent — VLC defaults to ~5.5 s and sets ephemer=true.
	 */
	stopMs: number | null;
	/** Canvas-ready RGBA bitmap, row-major, width×height pixels. */
	imageData: ImageData;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Resolved 4-entry working palette used during rendering (RGBA, 0–255 each). */
interface WorkingPalette {
	r: number[];
	g: number[];
	b: number[];
	/** Alpha 0–255 (SPU 4-bit value × 17). */
	a: number[];
}

/** Parsed SPU control-sequence data. */
interface SpuData {
	/** Byte offsets (from start of SPU payload, after the 4-byte header). */
	offsetEven: number;
	offsetOdd: number;
	palette: WorkingPalette;
	x: number;
	y: number;
	width: number;
	height: number;
	startMs: number | null;
	stopMs: number | null;
	/** RLE data size in bytes (= offsetEven, since RLE starts right after header). */
	rleSize: number;
}

// ---------------------------------------------------------------------------
// SPU command constants  (mirrors spudec/parse.c)
// ---------------------------------------------------------------------------
const SPU_CMD_FORCE_DISPLAY = 0x00;
const SPU_CMD_START_DISPLAY = 0x01;
const SPU_CMD_STOP_DISPLAY = 0x02;
const SPU_CMD_SET_PALETTE = 0x03;
const SPU_CMD_SET_ALPHA = 0x04;
const SPU_CMD_SET_COORDS = 0x05;
const SPU_CMD_SET_OFFSETS = 0x06;
const SPU_CMD_END = 0xFF;

// ---------------------------------------------------------------------------
// Step 1 – Reassemble: strip MPEG-2 PS / PES headers, collect SPU payload
// ---------------------------------------------------------------------------

/**
 * Walk the MPEG-2 PS packets in `chunk`, locate private_stream_1 (0xBD) PES
 * packets that carry DVD SPU data, and concatenate their payloads into a
 * single SPU buffer.
 *
 * Returns null if no valid SPU data could be extracted.
 *
 * Reference: VLC modules/demux/vobsub.c DemuxVobSub() and
 *            modules/codec/spudec/spudec.c Reassemble().
 */
function reassembleSpu(chunk: Uint8Array): Uint8Array | null {
	const packets: Uint8Array[] = [];
	let totalSize = 0;
	let expectedSpuSize = 0;
	let i = 0;

	while (i + 6 <= chunk.length) {
		// Every MPEG-2 PS packet starts with 00 00 01 <stream_id>
		if (chunk[i] !== 0x00 || chunk[i + 1] !== 0x00 || chunk[i + 2] !== 0x01) {
			break;
		}

		const streamId = chunk[i + 3];

		// Pack header (0xBA) or system header (0xBB) — skip
		if (streamId === 0xBA) {
			// Pack header: fixed 14 bytes + stuffing
			if (i + 14 > chunk.length) break;
			const stuffingLen = chunk[i + 13] & 0x07;
			i += 14 + stuffingLen;
			continue;
		}
		if (streamId === 0xBB) {
			// System header: 6-byte fixed + length field
			if (i + 6 > chunk.length) break;
			const len = (chunk[i + 4] << 8) | chunk[i + 5];
			i += 6 + len;
			continue;
		}

		// PES packet: 00 00 01 <id> <length_hi> <length_lo> <header...> <payload>
		if (i + 6 > chunk.length) break;
		const pesLen = (chunk[i + 4] << 8) | chunk[i + 5];
		const packetEnd = pesLen > 0 ? i + 6 + pesLen : chunk.length;

		if (streamId !== 0xBD) {
			// Not private_stream_1 — skip
			i = packetEnd;
			continue;
		}

		// Parse PES header to find payload start
		// Byte 6: flags1, Byte 7: flags2, Byte 8: header_data_length
		if (i + 9 > chunk.length) break;
		const headerDataLen = chunk[i + 8];
		const payloadStart = i + 9 + headerDataLen;

		// Extract PTS if present (flags2 bit 7: PTS_DTS_flags = 10 or 11)
		// We don't use PTS here — timing is derived from the .idx timestamp
		// passed in by the caller, plus the SPU command date offset.

		if (payloadStart >= chunk.length) { i = packetEnd; continue; }

		// First byte of payload is the sub-stream id (0x20–0x3F for SPU)
		const subStreamId = chunk[payloadStart];
		if ((subStreamId & 0xE0) !== 0x20) {
			// Not an SPU sub-stream
			i = packetEnd;
			continue;
		}

		const spuPayload = chunk.slice(payloadStart + 1, packetEnd);

		// First packet: read expected total SPU size from first 2 bytes
		if (packets.length === 0) {
			if (spuPayload.length < 2) { i = packetEnd; continue; }
			expectedSpuSize = (spuPayload[0] << 8) | spuPayload[1];
		}

		packets.push(spuPayload);
		totalSize += spuPayload.length;

		if (expectedSpuSize > 0 && totalSize >= expectedSpuSize) break;

		i = packetEnd;
	}

	if (packets.length === 0) return null;

	// Concatenate all payloads
	const spu = new Uint8Array(totalSize);
	let offset = 0;
	for (const p of packets) {
		spu.set(p, offset);
		offset += p.length;
	}
	return spu;
}

// ---------------------------------------------------------------------------
// Step 2 – ParseControlSeq: walk SPU command bytes
// ---------------------------------------------------------------------------

/**
 * Parse the SPU control sequence.
 *
 * The SPU layout is:
 *   [0..1]  total packet size  (uint16 BE)
 *   [2..3]  byte offset to first control sequence  (uint16 BE)
 *   [4 .. ctrlOffset-1]  RLE pixel data
 *   [ctrlOffset ..]  one or more control sequences
 *
 * Each control sequence:
 *   [0..1]  date in units of 11 ms  (uint16 BE)
 *   [2..3]  offset of next control sequence  (uint16 BE)
 *   [4..]   command bytes until SPU_CMD_END (0xFF)
 *
 * Reference: VLC modules/codec/spudec/parse.c ParseControlSeq()
 *
 * @param spu        - Reassembled SPU payload buffer.
 * @param ptsMsHint  - PTS of the packet in ms (from .idx timestamp), used as
 *                     the time base for START/STOP_DISPLAY dates.
 * @param clut       - 16-entry color lookup table from the .idx palette line.
 */
function parseControlSeq(
	spu: Uint8Array,
	ptsMsHint: number,
	clut: RgbColor[],
): SpuData | null {
	if (spu.length < 4) return null;

	const spuSize = (spu[0] << 8) | spu[1];
	const ctrlStart = (spu[2] << 8) | spu[3];

	if (ctrlStart < 4 || ctrlStart >= spu.length) return null;

	// RLE data occupies bytes [4 .. ctrlStart-1] (header is 4 bytes)
	const rleSize = ctrlStart - 4;

	// Working state — defaults match VLC's initialization
	let palette: WorkingPalette = {
		r: [0, 0, 0, 0],
		g: [0, 0, 0, 0],
		b: [0, 0, 0, 0],
		a: [0, 0xEE, 0xEE, 0xEE],   // alpha 0,15,15,15 → ×17
	};
	let offsetEven = -1;
	let offsetOdd = -1;
	let x = 0, y = 0, width = 0, height = 0;
	let startMs: number | null = null;
	let stopMs: number | null = null;

	let seqOffset = ctrlStart;

	while (seqOffset + 4 <= spu.length) {
		const dateRaw = (spu[seqOffset] << 8) | spu[seqOffset + 1];
		const nextSeq = (spu[seqOffset + 2] << 8) | spu[seqOffset + 3];
		const dateMs = dateRaw * 11;
		let i = seqOffset + 4;

		while (i < spu.length) {
			const cmd = spu[i];

			switch (cmd) {
				case SPU_CMD_FORCE_DISPLAY:
					startMs = ptsMsHint + dateMs;
					i += 1;
					break;

				case SPU_CMD_START_DISPLAY:
					startMs = ptsMsHint + dateMs;
					i += 1;
					break;

				case SPU_CMD_STOP_DISPLAY:
					stopMs = ptsMsHint + dateMs;
					i += 1;
					break;

				case SPU_CMD_SET_PALETTE: {
					// 03 <hi_byte> <lo_byte>
					// Each nibble is a CLUT index (0–15)
					// Order in VLC: idx[0]=buf[i+1]>>4, idx[1]=buf[i+1]&0xf,
					//               idx[2]=buf[i+2]>>4, idx[3]=buf[i+2]&0xf
					// The resolved colors map to pi_yuv[3-j] in VLC (reversed),
					// but here we keep them in straight 0–3 order for simplicity.
					if (i + 3 > spu.length) return null;
					const indices = [
						(spu[i + 1] >> 4) & 0x0F,
						spu[i + 1] & 0x0F,
						(spu[i + 2] >> 4) & 0x0F,
						spu[i + 2] & 0x0F,
					];
					for (let j = 0; j < 4; j++) {
						const color = clut[indices[j]] ?? { r: 0, g: 0, b: 0 };
						palette.r[j] = color.r;
						palette.g[j] = color.g;
						palette.b[j] = color.b;
					}
					i += 3;
					break;
				}

				case SPU_CMD_SET_ALPHA: {
					// 04 <hi_byte> <lo_byte>  — 4-bit alpha per entry, 0=transparent 15=opaque
					if (i + 3 > spu.length) return null;
					// VLC order: pi_alpha[3]=buf>>4, pi_alpha[2]=buf&f, pi_alpha[1]=..., pi_alpha[0]=...
					palette.a[3] = ((spu[i + 1] >> 4) & 0x0F) * 17;
					palette.a[2] = (spu[i + 1] & 0x0F) * 17;
					palette.a[1] = ((spu[i + 2] >> 4) & 0x0F) * 17;
					palette.a[0] = (spu[i + 2] & 0x0F) * 17;
					i += 3;
					break;
				}

				case SPU_CMD_SET_COORDS: {
					// 05 <6 bytes>  — two 12-bit x ranges and two 12-bit y ranges
					// x1 = buf[1]<<4 | buf[2]>>4
					// x2 = (buf[2]&0xf)<<8 | buf[3]
					// y1 = buf[4]<<4 | buf[5]>>4
					// y2 = (buf[5]&0xf)<<8 | buf[6]
					if (i + 7 > spu.length) return null;
					const x1 = (spu[i + 1] << 4) | (spu[i + 2] >> 4);
					const x2 = ((spu[i + 2] & 0x0F) << 8) | spu[i + 3];
					const y1 = (spu[i + 4] << 4) | (spu[i + 5] >> 4);
					const y2 = ((spu[i + 5] & 0x0F) << 8) | spu[i + 6];
					x = x1;
					y = y1;
					width = x2 - x1 + 1;
					height = y2 - y1 + 1;
					i += 7;
					break;
				}

				case SPU_CMD_SET_OFFSETS: {
					// 06 <2 bytes even> <2 bytes odd>  — byte offsets from start of RLE data
					// VLC subtracts 4 (the SPU header size) from the raw values.
					if (i + 5 > spu.length) return null;
					offsetEven = ((spu[i + 1] << 8) | spu[i + 2]) - 4;
					offsetOdd = ((spu[i + 3] << 8) | spu[i + 4]) - 4;
					i += 5;
					break;
				}

				case SPU_CMD_END:
					// End of this control sequence block
					i = spu.length; // break outer while
					break;

				default:
					// Unknown command — abort this control sequence
					i = spu.length;
					break;
			}
		}

		// If this sequence points to itself it's the last one
		if (nextSeq <= seqOffset) break;
		seqOffset = nextSeq;
	}

	if (offsetEven < 0 || offsetOdd < 0 || width <= 0 || height <= 0) return null;

	return {
		offsetEven,
		offsetOdd,
		palette,
		x, y, width, height,
		startMs, stopMs,
		rleSize,
	};
}

// ---------------------------------------------------------------------------
// Step 3 – ParseRLE: decode interlaced 2bpp nibble RLE
// ---------------------------------------------------------------------------

/**
 * Read one nibble (4 bits) from `src` at bit-index `*nibbleIdx` and
 * advance the index. Mirrors VLC's AddNibble().
 */
function addNibble(src: Uint8Array, nibbleIdx: { value: number }): number {
	const byteIdx = nibbleIdx.value >> 1;
	const isLow = (nibbleIdx.value & 1) === 1;
	nibbleIdx.value++;
	return isLow
		? (src[byteIdx] & 0x0F)
		: (src[byteIdx] >> 4);
}

/**
 * Decode the RLE pixel data into an array of packed run-length codes.
 *
 * Each returned uint16 value is:
 *   bits [15:2]  run length  (number of pixels)
 *   bits  [1:0]  color index (0–3)
 *
 * The two interlaced fields (even/odd scan lines) are merged into display
 * order by alternating the field pointer on every row, exactly as VLC does.
 *
 * Reference: VLC modules/codec/spudec/parse.c ParseRLE()
 */
function parseRle(
	spu: Uint8Array,
	data: SpuData,
): Uint16Array | null {
	const { width, height, offsetEven, offsetOdd } = data;

	// RLE data starts at byte 4 of the SPU buffer (after the 4-byte header).
	// offsetEven/offsetOdd are relative to the RLE start; add rleBase so that
	// addNibble's raw spu[] index lands at the correct absolute byte.
	const rleBase = 4;
	const nibbleOffsets = [(rleBase + offsetEven) * 2, (rleBase + offsetOdd) * 2];

	// Worst case: every pixel is its own run → width*height codes
	const codes = new Uint16Array(width * height);
	let codeCount = 0;

	let fieldId = 0; // 0 = even lines, 1 = odd lines

	for (let row = 0; row < height; row++) {
		const ni = { value: nibbleOffsets[fieldId] };
		let col = 0;

		while (col < width) {
			// Decode one RLE code: read nibbles until we have a non-zero
			// value in the minimum number of bits for the current step.
			// Thresholds: 1, 4, 16, 64  (2 bits, 4 bits, 6 bits, 8 bits total)
			let code = 0;
			for (let minVal = 1; minVal <= 0x40 && code < minVal; minVal <<= 2) {
				// Bounds check on the source buffer (ni.value already includes rleBase)
				const byteNeeded = ni.value >> 1;
				if (byteNeeded >= spu.length) return null;
				code = (code << 4) | addNibble(spu, ni);
			}

			if (code < 0x0004) {
				// All 14 significant bits are 0 → fill rest of line
				code = (width - col) << 2 | (code & 0x3);
			}

			if (codeCount >= codes.length) return null; // overflow guard
			codes[codeCount++] = code;
			col += code >> 2;
		}

		// Byte-align after each row (nibble index must land on an even nibble)
		if (nibbleOffsets[fieldId] !== ni.value) {
			nibbleOffsets[fieldId] = ni.value % 2 === 0 ? ni.value : ni.value + 1;
		} else {
			nibbleOffsets[fieldId] = ni.value;
		}

		// Alternate fields: even rows from field 0, odd rows from field 1
		fieldId ^= 1;
	}

	return codes.subarray(0, codeCount);
}

// ---------------------------------------------------------------------------
// Step 4 – Render: expand run-length codes into RGBA ImageData
// ---------------------------------------------------------------------------

/**
 * Expand the parsed RLE codes into a canvas ImageData.
 *
 * Reference: VLC modules/codec/spudec/parse.c Render()
 */
function render(codes: Uint16Array, data: SpuData): ImageData {
	const { width, height, palette } = data;
	const imageData = new ImageData(width, height);
	const pixels = imageData.data; // RGBA, 4 bytes per pixel

	let pixelIdx = 0;
	let codeIdx = 0;

	for (let row = 0; row < height; row++) {
		let col = 0;
		while (col < width && codeIdx < codes.length) {
			const code = codes[codeIdx++];
			const color = code & 0x3;
			const run = code >> 2;

			const r = palette.r[color];
			const g = palette.g[color];
			const b = palette.b[color];
			const a = palette.a[color];

			for (let k = 0; k < run && col < width; k++, col++) {
				pixels[pixelIdx++] = r;
				pixels[pixelIdx++] = g;
				pixels[pixelIdx++] = b;
				pixels[pixelIdx++] = a;
			}
		}
		// Pad any unfilled columns (shouldn't happen with well-formed data)
		while (col < width) {
			pixels[pixelIdx++] = 0;
			pixels[pixelIdx++] = 0;
			pixels[pixelIdx++] = 0;
			pixels[pixelIdx++] = 0;
			col++;
		}
	}

	return imageData;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse a raw .sub packet chunk into a canvas-ready bitmap.
 *
 * @param chunk     - Raw bytes from the .sub file for one subtitle entry.
 *                    Slice the file as `[filepos, filepos + size)` using
 *                    the values from {@link IdxEntry}.
 * @param clut      - 16-entry RGB palette from the `.idx` file's `palette:`
 *                    line (i.e. `IdxFile.palette`).
 * @param ptsMsHint - The timestamp of this entry in milliseconds (from
 *                    `IdxEntry.timestamp_ms`). Used as the time base for the
 *                    SPU START/STOP_DISPLAY command dates.
 * @returns A {@link SpuBitmap} ready for `ctx.putImageData()`, or `null` on
 *          parse failure.
 */
export function parseSubPacket(
	chunk: Uint8Array,
	clut: RgbColor[],
	ptsMsHint: number,
): SpuBitmap | null {
	const spu = reassembleSpu(chunk);
	if (!spu) return null;

	const data = parseControlSeq(spu, ptsMsHint, clut);
	if (!data) return null;

	const codes = parseRle(spu, data);
	if (!codes) return null;

	const imageData = render(codes, data);

	return {
		x: data.x,
		y: data.y,
		width: data.width,
		height: data.height,
		startMs: data.startMs,
		stopMs: data.stopMs,
		imageData,
	};
}
