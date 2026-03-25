/**
 * Parser for VobSub .idx subtitle index files.
 *
 * Based on the VobSub format as implemented by VLC (modules/demux/vobsub.c)
 * and mplayer's vobsub.c.
 *
 * An .idx file pairs with a .sub file (a raw MPEG-2 PS stream). The .idx
 * provides per-track metadata and a list of (timestamp, filepos) entries,
 * where each filepos is a byte offset into the .sub stream. The byte range
 * for a given subtitle packet is [filepos[i], filepos[i+1]).
 *
 * Timestamp format:  HH:MM:SS:mmm  (all colon-separated, including ms)
 * File position:     hexadecimal byte offset (e.g. 000001a2c)
 *
 * Palette:  16 RGB colors declared as a global directive before any track block.
 *   palette: rrggbb, rrggbb, ...
 *   VLC stores these as p_sys->palette[16] (vobsub.c).
 */

/** 8-bit red/green/blue color triple. */
export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

export interface IdxEntry {
	/** Start time of the subtitle packet in milliseconds. */
	timestamp_ms: number;
	/** Byte offset of the packet in the paired .sub file. */
	filepos: number;
	/**
	 * Byte length of the packet — computed as filepos[i+1] - filepos[i].
	 * null for the final entry in a track (end-of-file boundary unknown).
	 */
	size: number | null;
}

export interface IdxTrack {
	/** BCP-47 / ISO 639 language code from the `id:` directive, e.g. "en". */
	id: string;
	/** Stream index from the `index:` field of the `id:` directive. */
	index: number;
	entries: IdxEntry[];
}

export interface IdxFile {
	/** Original frame dimensions from the `size:` directive, if present. */
	size: { width: number; height: number } | null;
	/**
	 * 16-entry color palette from the `palette:` directive.
	 * Indices 0–3 are typically used by the DVD subtitle renderer:
	 *   0 = background, 1 = pattern, 2 = emphasis 1, 3 = emphasis 2.
	 * null when the directive is absent.
	 */
	palette: RgbColor[] | null;
	tracks: IdxTrack[];
}

/**
 * Parse the text content of a VobSub .idx file.
 *
 * @param content - Raw UTF-8 string content of the .idx file.
 * @returns Structured {@link IdxFile} with all tracks and their timestamp/range maps.
 */
export function parseIdx(content: string): IdxFile {
	const result: IdxFile = { size: null, palette: null, tracks: [] };
	let currentTrack: IdxTrack | null = null;

	for (const rawLine of content.split('\n')) {
		const line = rawLine.trim();

		// Skip blank lines and comment lines (VobSub comments start with #)
		if (!line || line.startsWith('#')) continue;

		// "size: 720x480"
		const sizeMatch = line.match(/^size:\s*(\d+)x(\d+)/i);
		if (sizeMatch) {
			result.size = {
				width: parseInt(sizeMatch[1], 10),
				height: parseInt(sizeMatch[2], 10),
			};
			continue;
		}

		// "palette: rrggbb, rrggbb, ..."  — 16 global RGB entries (VLC: p_sys->palette[16])
		if (line.startsWith('palette:')) {
			const hexTokens = line.slice('palette:'.length).split(',');
			result.palette = hexTokens.slice(0, 16).map((token) => {
				const hex = token.trim().padStart(6, '0');
				return {
					r: parseInt(hex.slice(0, 2), 16),
					g: parseInt(hex.slice(2, 4), 16),
					b: parseInt(hex.slice(4, 6), 16),
				};
			});
			continue;
		}

		// "id: en, index: 0"  — begins a new language track
		const idMatch = line.match(/^id:\s*(\w+),\s*index:\s*(\d+)/i);
		if (idMatch) {
			currentTrack = {
				id: idMatch[1],
				index: parseInt(idMatch[2], 10),
				entries: [],
			};
			result.tracks.push(currentTrack);
			continue;
		}

		// "timestamp: 00:01:25:880, filepos: 000000000"
		// VLC / mplayer both use HH:MM:SS:mmm (colon before milliseconds)
		const entryMatch = line.match(
			/^timestamp:\s*(\d{2}):(\d{2}):(\d{2}):(\d{3}),\s*filepos:\s*([0-9a-f]+)/i,
		);
		if (entryMatch && currentTrack) {
			const [, h, m, s, ms, hex] = entryMatch;
			const timestamp_ms =
				parseInt(h, 10) * 3_600_000 +
				parseInt(m, 10) * 60_000 +
				parseInt(s, 10) * 1_000 +
				parseInt(ms, 10);
			const filepos = parseInt(hex, 16);
			currentTrack.entries.push({ timestamp_ms, filepos, size: null });
		}
	}

	// Derive packet byte ranges: size[i] = filepos[i+1] - filepos[i].
	// The last entry in each track has no known upper bound, so size stays null.
	for (const track of result.tracks) {
		for (let i = 0; i < track.entries.length - 1; i++) {
			track.entries[i].size = track.entries[i + 1].filepos - track.entries[i].filepos;
		}
	}

	return result;
}

/**
 * Look up the {@link IdxEntry} whose packet contains the given playback time.
 *
 * Returns the last entry whose timestamp is ≤ `timeMs`, or null if the
 * provided time precedes all entries in the track.
 *
 * @param track   - A single {@link IdxTrack} (from {@link parseIdx}).
 * @param timeMs  - Playback position in milliseconds.
 */
export function findEntryAtTime(track: IdxTrack, timeMs: number): IdxEntry | null {
	let result: IdxEntry | null = null;
	for (const entry of track.entries) {
		if (entry.timestamp_ms <= timeMs) {
			result = entry;
		} else {
			break;
		}
	}
	return result;
}
