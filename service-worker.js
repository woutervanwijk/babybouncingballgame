// Service worker with Network-First strategy to avoid aggressive caching
const CACHE_NAME = 'baby-ball-game-v4';
const urlsToCache = [
  './',
  'index.html',
  'styles.css',
  'game.js',
  'phaser/phaser.min.js',
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png',
  'svg/ball.svg',
  'svg/cloud.svg',
  'svg/sun.svg',
  'svg/reset.svg'
];

self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, pre-fetching core assets');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Bypassing cache for sounds - Safari on iOS doesn't play audio from a service worker cache well
  if (event.request.url.includes('assets/audio/')) {
    return;
  }

  // Network-First strategy: try the network first, then fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we have a valid response, clone it and update the cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), try the cache
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Allow the service worker to take control of all pages in its scope immediately
      return self.clients.claim();
    })
  );
});