/* Sprout — self-destructing service worker.
 *
 * A previous caching SW left some devices stuck on stale builds. This version
 * unregisters itself, deletes all caches, and reloads open tabs so everyone drops
 * to the live network build. It does NO caching (pass-through fetch). The app no
 * longer registers a SW, so this runs once to clean up and then disappears. */
self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
    } finally {
      await self.registration.unregister();
    }
  })());
});

// pass-through: never serve from cache
self.addEventListener('fetch', function () {});
