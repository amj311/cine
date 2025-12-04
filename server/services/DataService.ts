/**
 * Responsible for persisting data in mounted storage.
 * Also holds data in-memory for quick retrieval.
 * Although this has drawbacks over a DB, a JSON file has a certain longevity for a system I don't want to spend a lot of time maintaining.
 * We WILL need to address data migrations in some way.
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import path from 'path';
import { PromiseQueue } from '../utils/PromiseQueue';

/**
 * Stores and Datums are analogous to tables and rows.
 * Each datum must have a unique key.
 * All data in a store must match the datatype of their version.
 */

type namespace = string;
type datumKey = string;

export class Store<N extends namespace = namespace, T = any> {
	private versions: Map<number, StoreVersion> = new Map();

	constructor(
		readonly namespace: N,
		migrators: Array<(oldT: any) => T> = [],
	) {
		// define initial version with no up
		this.versions.set(1, new InitialStoreVersion<T>());
		migrators.forEach((up, i) => {
			// the first migrator will be for version 2
			this.versions.set(i + 2, new StoreVersion(i + 2, up));
		});

		DataService.registerStore(this)
	};

	private get currentVersion() {
		return this.versions.size;
	}

	public async getAll(): Promise<Array<T>> {
		const data = (await DataService.findAll(this.namespace)) as Array<Datum<T>>;
		return data.map(this.migrateDatum.bind(this)).map(d => d.data);
	}

	public async getByKey(key: string): Promise<T | null> {
		const datum = (await DataService.findByKey(this.namespace, key));
		return datum ? this.migrateDatum(datum).data : null;
	}

	private migrateDatum(datum: Datum<any>): Datum<T> {
		let migrated = datum;
		let usingVersion = migrated.version;

		while (usingVersion < this.currentVersion) {
			usingVersion += 1;
			const upVersion = this.versions.get(usingVersion);
			if (!upVersion) {
				throw new Error(`No migrator for version ${usingVersion}`)
			}
			migrated = upVersion.migrate(migrated);
		}

		if (migrated.version !== this.currentVersion) {
			throw new Error("Failed to migrate datum up to current version")
		}
		return migrated as Datum<T>;
	}

	public async set(key: string, data: T) {
		const datum = {
			namespace: this.namespace,
			version: this.currentVersion,
			key,
			data,
		};

		await DataService.post(this.namespace, datum);
	}
}

export type Datum<T = any> = {
	version: number,
	key: datumKey,
	data: T,
}

class StoreVersion<T = any, PrevT = any> {
	constructor(
		readonly version: number,
		readonly up: (d: Datum<PrevT>) => T,
	) { }

	public migrate(oldDatum: Datum<PrevT>) {
		if (oldDatum.version !== this.version - 1) {
			throw new Error(`Cannot migrate datum from ${oldDatum.version} to ${this.version}`);
		}

		return {
			version: this.version,
			key: oldDatum.key,
			data: this.up(oldDatum),
		}
	}
}

class InitialStoreVersion<T> extends StoreVersion<T> {
	constructor() {
		super(1, () => null as T);
	}

	public migrate(oldDatum: any): any {
		throw new Error("Something is wrong. Migrate should never be called on an initial version!");
	}
}











const DATA_FILE_NAME = "oliveplex_data.json";
const DEFAULT_WRITE_INTERVAL_MS = 1000 * 60 * 15;

type DataFile<T> = {
	version: number;
} & T;

type DataFileV1 = DataFile<{
	data: Record<namespace, Record<datumKey, Datum>>
}>;

class DataService {
	private static storeIndex: Map<string, Store<string, any>> = new Map();
	private static fileData: DataFileV1;
	private static ioQueue = new PromiseQueue();

	private static updates = 0;
	private static hasInit = false;

	private static get dataPath() {
		if (!process.env.DATA_DIR) {
			throw new Error("Data dir variable is not set")
		}
		return path.join(process.env.DATA_DIR, DATA_FILE_NAME);
	}

	private static get storeData() {
		if (!this.fileData) {
			throw new Error("File data has not been loaded yet!")
		}
		return this.fileData.data;
	}

	private static async init() {
		if (this.hasInit) {
			return;
		}

		await this.ioQueue.add(async () => {
			// make sure path exists
			let fileExists = true;
			try {
				await access(this.dataPath);
			} catch (e) {
				fileExists = false;
			}

			if (!fileExists) {
				if (!process.env.DATA_DIR) {
					throw new Error("Data dir variable is not set")
				}
				await mkdir(process.env.DATA_DIR, { recursive: true });
				await writeFile(this.dataPath, '{ "version": 1, "data": {} }');
			}

			let dataFile: DataFileV1;
			try {
				let json = (await readFile(this.dataPath)).toString();
				dataFile = JSON.parse(json);
			} catch (e) {
				console.error("Failed to load data file!");
				console.error(e);
				throw e;
			}

			if (dataFile.version !== 1) {
				throw new Error("No support for migrations yet!")
			}

			this.fileData = dataFile;
		})

		if (!process.env.DATA_DIR) {
			throw new Error('DATA_DIR environment variable is not set');
		}

		const writeInterval = process.env.DATA_WRITE_INTERVAL_MS ? Number(process.env.DATA_WRITE_INTERVAL_MS) : DEFAULT_WRITE_INTERVAL_MS;
		setInterval(this.writeToFile.bind(this), writeInterval);
		this.hasInit = true;
	}

	private static async writeToFile() {
		// only write if updates have been triggered
		if (this.updates === 0) {
			return;
		}
		try {
			await DataService.ioQueue.add(async () => {
				await writeFile(this.dataPath, JSON.stringify(this.fileData))
			})
			this.updates = 0;
		} catch (e) {
			console.error("Error while writing data file");
			console.error(e);
		}
	}

	public static registerStore(store: Store) {
		if (this.storeIndex.has(store.namespace)) {
			throw new Error(`${store.namespace} store is already registered!`);
		}
		this.storeIndex.set(store.namespace, store);
	}

	/**
	 * Normalizes a namespace entry before accessing it
	 * @param namespace 
	 */
	private static async touchNamespace(namespace: namespace) {
		await this.init()
		if (!this.storeData[namespace]) {
			this.storeData[namespace] = {};
		}
	}
	private static async loadNamespace(namespace: namespace) {
		await this.touchNamespace(namespace);
		return this.storeData[namespace];
	}

	public static async findByKey(namespace: namespace, key: datumKey): Promise<Datum | null> {
		const space = await this.loadNamespace(namespace);
		return space[key] || null;
	}

	public static async findAll(namespace: namespace) {
		const space = await this.loadNamespace(namespace);
		return await Array.from(Object.values(space));
	}

	private static async doUpdate(namespace: namespace, datum: Datum) {
		await this.touchNamespace(namespace);
		this.storeData[namespace][datum.key] = datum;
		this.updates += 1;
	}

	public static async post(namespace: namespace, datum: Datum) {
		await this.doUpdate(namespace, datum);
	}
}
