// Service worker template. vite.config.js fills in the version and file list at build time
// and writes dist/sw.js. It keeps the same path (/sw.js) as Pour v1's worker, so phones
// that ran v1 receive this one through the browser's normal update check.
const CACHE = 'pour-app-__VERSION__';
const FILES = __FILES__;
const V1_CACHE = 'pour-pos-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Old app caches (including v1's) are removed. Shop data is not in them: it lives in
  // localStorage (v1) and IndexedDB (v2). A phone upgrading from v1 may show the v1 page one
  // last time; the v1 files are still deployed, so that page works, and the next launch is v2.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('pour-app-') && k !== CACHE) || k === V1_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const options = { ignoreVary: true };
  if (request.mode === 'navigate') {
    // Network first for the page, so a new deploy shows up immediately when online;
    // the cached copy is used offline.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html', options)),
    );
    return;
  }
  event.respondWith(caches.match(request, options).then((cached) => cached || fetch(request)));
});
