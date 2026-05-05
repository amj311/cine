import { DirectoryService } from './DirectoryService';
import { LibraryService } from './LibraryService';

export type NowPlayingTitleFilter = 'movie' | 'series' | null;

export type NowPlayingSource = {
	directory: string;
	count: number;
	filter?: NowPlayingTitleFilter;
};

export type NowPlayingConfig = {
	defaultSources: NowPlayingSource[];
	dayOverrides: { [day: number]: NowPlayingSource[] | null };
};

export class NowPlayingService {
	public static async getTodayTitles(config: NowPlayingConfig): Promise<{ titles: any[]; date: string }> {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const dateString = `${year}-${month}-${day}`; // YYYY-MM-DD in server local time
		const dayOfWeek = now.getDay(); // 0 (Sun) – 6 (Sat)

		const sources: NowPlayingSource[] =
			dayOfWeek in config.dayOverrides
				? (config.dayOverrides[dayOfWeek] ?? [])
				: config.defaultSources;

		if (!sources.length) {
			return { titles: [], date: dateString };
		}

		const allTitles: any[] = [];
		for (const source of sources) {
			const resolvedPath = DirectoryService.resolvePath(source.directory);
			if (!resolvedPath) continue;

			const { items } = await LibraryService.getFlatTree(resolvedPath);
			let titleItems = items
				.filter((item) => item.libraryTier === 'title')
				.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

			if (source.filter === 'movie') {
				titleItems = titleItems.filter((item: any) => item.cinemaType === 'movie');
			} else if (source.filter === 'series') {
				titleItems = titleItems.filter((item: any) => item.cinemaType === 'series');
			}

			// Seed includes the source directory so different sources get independent shuffles
			const shuffled = seededShuffle(titleItems, `${dateString}:${source.directory}`);
			allTitles.push(...shuffled.slice(0, source.count));
		}

		return { titles: allTitles, date: dateString };
	}
}

/**
 * Deterministic Fisher-Yates shuffle seeded from a string.
 * Uses a Mulberry32 PRNG so the same seed always produces the same shuffle.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
	const result = [...arr];
	let s = stringToUint32(seed);
	const rand = mulberry32(s);
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function mulberry32(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s += 0x6d2b79f5;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function stringToUint32(str: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}
