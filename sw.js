// sw.js — Service Worker для uRay
// Стратегия:
//   - Оболочка (HTML, JS, CSS) — cache-first, обновляется в фоне (stale-while-revalidate)
//   - Уровни (levels/*.txt, levels/index.json) — network-first, fallback на кэш
//   - Всё остальное — network, fallback на кэш

const VERSION = 'uray-v3';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './level.js',
  './profile.js',
  './bottom.js',
  './raytrace.js',
  './fan.js',
  './render.js',
  './input.js',
  './impulse-response.js',
  './audio.js',
  './achievements.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Только свои
  if (url.origin !== location.origin) return;

  // Уровни — network first
  if (url.pathname.includes('/levels/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Оболочка — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});