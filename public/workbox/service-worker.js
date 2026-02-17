importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.core.setCacheNameDetails({ prefix: 'subtrack' });
  workbox.precaching.precacheAndRoute([
    ...(self.__WB_MANIFEST || []),
    { url: '/offline.html', revision: null },
    { url: '/manifest.json', revision: null },
    { url: '/icon.svg', revision: null }
  ]);

  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      try {
        return await fetch('/');
      } catch (e) {
        return caches.match('/offline.html');
      }
    }
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate()
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({ cacheName: 'images' })
  );

  self.addEventListener('sync', event => {
    if (event.tag === 'sync-transactions') {
      // Background sync stub
    }
  });
} else {
  // eslint-disable-next-line no-console
  console.log('Workbox failed to load');
}
