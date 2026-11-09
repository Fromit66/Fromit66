// FitTrainer High-Performance Offline-First Service Worker
const CACHE_NAME = 'fittrainer-v5-prod';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache non-blocking warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and http/https schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const url = new URL(event.request.url);

  // 1. NAVIGATION REQUESTS (HTML page): Stale-While-Revalidate / Cache-First for instant 0ms mobile launch
  if (isNavigation) {
    event.respondWith(
      (async () => {
        // Check cache first (ignore query parameters like ?routine=...)
        const cachedIndex =
          (await caches.match(event.request, { ignoreSearch: true })) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/'));

        // Background network fetch to keep cache updated
        const networkFetch = fetch(event.request)
          .then(async (networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const toCache = networkRes.clone();
              const cache = await caches.open(CACHE_NAME);
              cache.put(event.request, toCache);
              cache.put('/index.html', networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => null);

        // If we already have the cached page, return it immediately!
        // This guarantees the app opens instantly at the gym without waiting for slow cellular network.
        if (cachedIndex) {
          // Revalidate in background without blocking render
          event.waitUntil(networkFetch);
          return cachedIndex;
        }

        // Not cached yet: wait for network
        try {
          const freshRes = await networkFetch;
          if (freshRes && freshRes.status === 200) {
            return freshRes;
          }
        } catch {}

        // Fallback to any cached HTML
        if (cachedIndex) return cachedIndex;

        // Emergency offline fallback screen
        return new Response(
          '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FitTrainer</title></head><body style="background:#020617;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;"><h2>FitTrainer</h2><p>Iniciando entrenador personal...</p><button onclick="location.reload()" style="background:#10b981;color:#020617;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:1rem;">Entrar</button></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // 2. STATIC ASSETS (JavaScript Bundles, CSS, Images, Fonts)
  event.respondWith(
    (async () => {
      // Check cache first
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) {
        // Revalidate in background if online
        fetch(event.request)
          .then(async (networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(event.request, networkRes.clone());
            }
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache: fetch from network
      try {
        const networkRes = await fetch(event.request);
        if (networkRes && networkRes.status === 200) {
          const toCache = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        } else if (!networkRes || networkRes.status >= 400) {
          // Server error or container asleep (502/503/404): try cache without query parameters
          const fallbackReq = new Request(url.origin + url.pathname);
          const fallbackMatch = await caches.match(fallbackReq);
          if (fallbackMatch) return fallbackMatch;
        }
        return networkRes;
      } catch (fetchErr) {
        // Offline or connection failed: fallback to cache
        const fallbackReq = new Request(url.origin + url.pathname);
        const fallbackMatch =
          (await caches.match(event.request, { ignoreSearch: true })) ||
          (await caches.match(fallbackReq));
        if (fallbackMatch) return fallbackMatch;

        throw fetchErr;
      }
    })()
  );
});
