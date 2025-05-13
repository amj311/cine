const CACHE_NAME = `oliveplex-v1`;
const OFFLINE_URL = '/index.html';

// Use the install event to pre-cache all essential resources.
self.addEventListener('install', event => {
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll([
			OFFLINE_URL,
			'/src/main.ts',
			'/public/favicon.ico',
			'/public/Popcorn-Emoji-512.png',
			'/public/manifest.json',
			'/assets', // Adjust this path if assets are stored elsewhere
		]);
	})());
});

// Intercept fetch requests and serve cached resources when offline.
self.addEventListener('fetch', event => {
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);

		// Try to fetch the resource from the network.
		try {
			const fetchResponse = await fetch(event.request);
			// Cache the fetched resource for future use.
			cache.put(event.request, fetchResponse.clone());
			return fetchResponse;
		} catch (e) {
			// If the network fails, try to serve the resource from the cache.
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}

			// If the resource is not in the cache, serve the offline fallback.
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