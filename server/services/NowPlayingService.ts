import { Store } from './DataService';
import { DirectoryService } from './DirectoryService';
import { LibraryService } from './LibraryService';

export type NowPlayingConfig = {
	count: number;
	defaultSource: string | null;
	dayOverrides: { [day: number]: string | null };
};

const DEFAULT_CONFIG: NowPlayingConfig = {
	count: 5,
	defaultSource: null,
	dayOverrides: {},
};

const CONFIG_KEY = 'config';
const configStore = new Store<NowPlayingConfig>('nowPlayingConfig');

export class NowPlayingService {
	public static async getConfig(): Promise<NowPlayingConfig> {
		return (await configStore.getByKey(CONFIG_KEY)) ?? { ...DEFAULT_CONFIG };
	}

	public static async saveConfig(config: NowPlayingConfig): Promise<void> {
		await configStore.set(CONFIG_KEY, config);
	}

	public static async getTodayTitles(): Promise<{ titles: any[]; date: string }> {
		const now = new Date();
		const dateString = now.toISOString().slice(0, 10); // YYYY-MM-DD
		const dayOfWeek = now.getDay(); // 0 (Sun) – 6 (Sat)

		const config = await NowPlayingService.getConfig();

		const source =
			config.dayOverrides[dayOfWeek] !== undefined
				? config.dayOverrides[dayOfWeek]
				: config.defaultSource;

		if (!source) {
			return { titles: [], date: dateString };
		}

		const resolvedPath = DirectoryService.resolvePath(source);
		if (!resolvedPath) {
			return { titles: [], date: dateString };
		}

		const { items } = await LibraryService.getFlatTree(resolvedPath);
		const titleItems = items
			.filter((item) => item.libraryTier === 'title')
			.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

		const shuffled = seededShuffle(titleItems, dateString);
		return { titles: shuffled.slice(0, config.count), date: dateString };
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
