/* Sprout LOS — service worker (network-first PWA shell) */
const CACHE = 'sprout-los-v8';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './app/index.html',
  './app/app.css',
  './app/config.js',
  './app/id-verify.js',
  './app/app.js',
  './app/kyc.js',
  './manifest.webmanifest',
  './assets/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Network-first: always try the live build, fall back to cache only when offline.
   This guarantees a fresh app shell after every deploy (no more stale renders). */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() =>
      caches.match(e.request).then((cached) => cached || caches.match('./index.html'))
    )
  );
});
