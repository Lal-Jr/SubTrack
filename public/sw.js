self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            return self.registration.unregister();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Do nothing, let the browser handle the fetch naturally for dev
});
