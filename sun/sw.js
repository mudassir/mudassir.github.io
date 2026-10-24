// Offline cache for the web build. Everything is served from the cache
// first, so the app opens without a connection after the first visit.
//
// tool/build_web.sh replaces the two placeholders below at build time; a new
// version makes the browser install this worker again and drop old caches.
'use strict';

const VERSION = '1a05b8080424';
const PRECACHE = ["./", "assets/AssetManifest.bin", "assets/AssetManifest.bin.json", "assets/FontManifest.json", "assets/NOTICES", "assets/fonts/MaterialIcons-Regular.otf", "assets/fonts/fallback/Roboto-Regular.ttf", "assets/packages/cupertino_icons/assets/CupertinoIcons.ttf", "assets/shaders/ink_sparkle.frag", "assets/shaders/stretch_effect.frag", "favicon.png", "flutter.js", "flutter_bootstrap.js", "icons/Icon-192.png", "icons/Icon-512.png", "icons/Icon-maskable-192.png", "icons/Icon-maskable-512.png", "icons/apple-touch-icon.png", "index.html", "main.dart.js", "manifest.json", "version.json"];
const CACHE = `sun-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

// The page reports which rendering engine files it loaded (they differ by
// browser), so they can be cached without downloading every variant.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => new URL(u).origin === self.location.origin);
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)).catch(() => {}));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Page loads (e.g. from the home screen) always get the cached shell.
      const key = request.mode === 'navigate' ? 'index.html' : request;
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })(),
  );
});
