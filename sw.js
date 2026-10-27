const CACHE_NAME = 'esignature-cache-v1.0.1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg'
];

// Install: Cache initial app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first with dynamic asset caching & offline fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only cache GET requests (http/https)
  if (req.method !== 'GET' || !req.url.startsWith('http')) {
    return;
  }

  // Handle navigation requests (SPA HTML loading)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('./') || caches.match('./index.html');
      })
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, toCache);
        });

        return response;
      });
    })
  );
});
