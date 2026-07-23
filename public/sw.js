const CACHE_PREFIX = 'mindweave-';
const DEPLOYMENT_ID = new URL(self.location.href).searchParams.get('v') || 'fallback';
const CACHE_NAME = `${CACHE_PREFIX}${DEPLOYMENT_ID}`;
const STATIC_ASSETS = [
  '/manifest.json',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// A waiting worker is activated only after the app confirms it is safe.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Only the explicit app-shell assets above are cached by the service worker.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // API/auth/user data and Next.js hashed assets keep their normal browser/network behavior.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;

  // HTML is always fetched from the network and is never stored by this worker.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => new Response('네트워크 연결을 확인해 주세요.', { status: 503 }))
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
