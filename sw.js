'use strict';

const CACHE = 'begencheke-pwa-v15';

const FILES = [
  './',
  './index.html',
  './style.css?v=15',
  './app.js?v=15',
  './manifest.json',
  './icon.png'
];

/* YENI SURUMU YUKLE */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

/* ESKI ONBELLEGI TEMIZLE */

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith('begencheke-pwa-') &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

/* INTERNET VARSA GUNCEL DOSYAYI AL */

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await cache.match(request);

        if (cached) return cached;

        if (request.mode === 'navigate') {
          const fallback = await cache.match('./index.html');

          if (fallback) return fallback;
        }

        return Response.error();
      }
    })()
  );
});
