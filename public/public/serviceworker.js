const CACHE_NAME = `oliveplex-v1`;
const OFFLINE_URL = '/';

addEventListener("message", (event) => {
	if (event.data.type === 'indexResources') {
		cacheIndexResources(event.data.indexResources).catch(console.log);
	}
});

async function cacheIndexResources(indexResources) {
	try {
		const cache = await caches.open(CACHE_NAME);
		// remove previous indexResources
		const previousItems = await getData('indexResources');
		if (previousItems) {
			const oldItems = previousItems.filter(item => !indexResources.includes(item));
			await Promise.all(oldItems.map(item => cache.delete(item)));
		}
		await cache.addAll([OFFLINE_URL, ...indexResources]);
		await setData('indexResources', indexResources);
	}
	catch (e) {
		console.error("Failed to cache indexResources");
		console.error(e);
	}
};

// Intercept fetch requests and serve cached resources when offline, but only cache URLs matching certain patterns.
const CACHE_URL_PATTERNS = [
	/^\/$/, // root
	/^\/index\.html$/,
	/^\/public\//,
	/^\/assets\//
];

function shouldCache(url) {
	const path = new URL(url, self.location.origin).pathname;
	return CACHE_URL_PATTERNS.some(pattern => pattern.test(path));
}

self.addEventListener('fetch', event => {
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);

		try {
			const fetchResponse = await fetch(event.request);
			// Only cache if the URL matches our patterns.
			if (shouldCache(event.request.url)) {
				cache.put(event.request, fetchResponse.clone());
			}
			return fetchResponse;
		} catch (e) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}
			if (event.request.mode === 'navigate') {
				return cache.match(OFFLINE_URL);
			}
		}
	})());
});

// Clean up old caches during the activate event.
self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		const cacheNames = await caches.keys();
		await Promise.all(
			cacheNames.map(cacheName => {
				if (cacheName !== CACHE_NAME) {
					return caches.delete(cacheName);
				}
			})
		);
	})());
});



// Simple IndexedDB helper
function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('sw-db', 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore('kv');
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function setData(key, value) {
	const db = await openDB();
	const tx = db.transaction('kv', 'readwrite');
	tx.objectStore('kv').put(value, key);
	return tx.complete;
}

async function getData(key) {
	const db = await openDB();
	const tx = db.transaction('kv', 'readonly');
	const request = tx.objectStore('kv').get(key);
	return new Promise((resolve, reject) => {
		request.onsuccess = () => {
			if (request.readyState === 'done') {
				resolve(request.result);
			}
		};
		request.onerror = () => reject(request.error);
	});
}