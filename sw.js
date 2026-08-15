// Offline support for Chinese Companion.
//
// Strategy is deliberately network-first, not cache-first or
// stale-while-revalidate: this app has hit real, repeated bugs this
// session from *plain HTTP* caching serving stale content after a
// deploy. A service worker cache is stickier than HTTP cache, so
// making it cache-first would make that problem worse, not better.
// Network-first means: whenever there's a connection, you always get
// the live server's current version, full stop — the cache is purely
// a fallback for when there's genuinely no network (e.g. Travel
// Phrases with no signal in China, the actual point of this feature).
// Every successful network response also refreshes the cache, so it
// stays reasonably current without any manual cache-busting.
//
// Bump CACHE_VERSION when the set of precached files changes (a new
// data file added, etc.) to force immediate re-precaching on next
// install; it's not required for routine content updates, since the
// network-first fetch handler self-heals the cache on every online
// visit regardless of version.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `chinese-companion-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'icon.svg',
  'icon-180.png',
  'icon-32.png',
  'data/vocab.json',
  'data/hsk1.json',
  'data/hsk2.json',
  'data/hsk3.json',
  'data/hsk4.json',
  'data/grammar.json',
  'data/phrases.json',
  'data/learning.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        // waitUntil extends the event's lifetime for this write, without
        // delaying the response — without it the browser could recycle
        // the worker before the cache actually gets refreshed.
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        );
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Offline + no cached entry for this exact URL: for a page
        // navigation, fall back to the cached app shell rather than
        // failing outright (e.g. opening the Home Screen icon fresh
        // while offline).
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('index.html');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
