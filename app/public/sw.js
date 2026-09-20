// Bermi One's offline shell.
//
// Deliberately small. The app's data lives in Supabase and must never be served
// stale — a bar reading yesterday's stock as today's is worse than a bar that
// cannot load at all. So: the built assets are cached so the app opens without
// a network, and every API call goes straight to the network, always.

// The build stamps a version into the registration URL (/sw.js?v=...). Without
// it the cache name was a constant, so a deploy left the previous index.html in
// place as the offline fallback — pointing at asset hashes that no longer
// exist, which is an app that opens to a blank screen.
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const VERSION = `bermi-${BUILD}`;

// Only files whose contents never change under their own name. index.html is
// deliberately absent: it is cached from the network on every navigation
// instead, so the offline copy always names assets that still exist.
const SHELL = ['/manifest.webmanifest', '/favicon.svg', '/icons/bermi-mark.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // One missing icon must not fail the whole install and leave the app
      // with no worker at all.
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
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

  // Navigations go to the network and the answer is kept, so the offline copy
  // is always the most recent index.html rather than whatever was current the
  // day the worker first installed. Offline, the cached shell opens the app and
  // the router takes over, which is also what makes a refresh on a deep link
  // work without a round trip.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(VERSION).then((c) => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
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
