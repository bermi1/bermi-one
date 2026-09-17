// Bermi One's offline shell.
//
// Deliberately small. The app's data lives in Supabase and must never be served
// stale — a bar reading yesterday's stock as today's is worse than a bar that
// cannot load at all. So: the built assets are cached so the app opens without
// a network, and every API call goes straight to the network, always.

const VERSION = 'bermi-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/bermi-mark.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Anything that is not our own origin — Supabase above all — is never cached.
  if (url.origin !== self.location.origin) return;

  // Navigations fall back to the cached shell so the app still opens offline;
  // the router then takes over, which is also what makes a refresh on a deep
  // link work without a round trip.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed build assets are immutable, so cache-first is safe and fast.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          void caches.open(VERSION).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
