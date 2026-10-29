'use strict';

const CACHE = 'begencheke-pwa-v20';

const FILES = [
  './',
  './index.html',
  './style.css?v=15',
  './app.js?v=20',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith('begencheke-pwa-') &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      try {
        const response = await fetch(event.request);

        if (response.ok) {
          await cache.put(event.request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await cache.match(event.request);

        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          return await cache.match('./index.html') ||
            Response.error();
        }

        return Response.error();
      }
    })()
  );
});
