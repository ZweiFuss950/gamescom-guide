/* GC26 Guide service worker – deploy 2026-08-23 */
const CACHE_VERSION = 'gc26-guide-v3-1-20260823-3';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './data/data.json',
  './data/schema.json',
  './assets/icons/favicon.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/map/simplified-halls.svg',
  './assets/illustrations/xbox.svg',
  './assets/illustrations/nintendo.svg',
  './assets/illustrations/publisher.svg',
  './assets/illustrations/community.svg',
  './assets/illustrations/indie.svg',
  './assets/illustrations/retro.svg',
  './assets/illustrations/hardware.svg',
  './assets/illustrations/talk.svg',
  './assets/illustrations/reality.svg',
  './assets/illustrations/map.svg'
];

const absolute = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL.map(absolute)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.origin === scope.origin) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(absolute('./index.html'), response.clone());
        }
        return response;
      } catch {
        return (await caches.match(absolute('./index.html'))) ||
          (await caches.match(absolute('./offline.html'))) ||
          new Response('Offline – bitte die App einmal online öffnen.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  if (url.origin === scope.origin && url.href.startsWith(scope.href)) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) {
        event.waitUntil(fetch(request).then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(request, response.clone());
          }
        }).catch(() => undefined));
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        if (request.destination === 'image') {
          return caches.match(absolute('./assets/illustrations/map.svg'));
        }
        throw new Error('resource unavailable offline');
      }
    })());
  }
});
