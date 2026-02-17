// Register the service worker for PWA/offline support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/workbox/service-worker.js').then(
      reg => {
        // Registration successful
      },
      err => {
        // Registration failed
        // eslint-disable-next-line no-console
        console.error('SW registration failed:', err);
      }
    );
  });
}
