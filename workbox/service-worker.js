importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.core.setCacheNameDetails({prefix: 'subtrack'});
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate()
  );
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({cacheName: 'images'})
  );
  // Background sync stub
  self.addEventListener('sync', event => {
    if (event.tag === 'sync-transactions') {
      // Placeholder for background sync logic
    }
  });
} else {
  console.log('Workbox failed to load');
}
