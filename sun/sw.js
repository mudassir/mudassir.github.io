// Offline cache for the web build. When online, every request goes to the
// network first (so updates appear immediately) and the response is saved;
// when offline, or if the network is too slow, the saved copy is used.
//
// tool/build_web.sh replaces the two placeholders below at build time; a new
// version makes the browser install this worker again and drop old caches.
'use strict';

const VERSION = 'eff77e6f010a';
const PRECACHE = ["./", "assets/AssetManifest.bin", "assets/AssetManifest.bin.json", "assets/FontManifest.json", "assets/NOTICES", "assets/assets/cities.txt", "assets/fonts/MaterialIcons-Regular.otf", "assets/fonts/fallback/Roboto-Regular.ttf", "assets/packages/cupertino_icons/assets/CupertinoIcons.ttf", "assets/shaders/ink_sparkle.frag", "assets/shaders/stretch_effect.frag", "favicon.png", "flutter.js", "flutter_bootstrap.js", "icons/Icon-192.png", "icons/Icon-512.png", "icons/Icon-maskable-192.png", "icons/Icon-maskable-512.png", "icons/apple-touch-icon.png", "index.html", "main.dart.js", "manifest.json", "version.json"];
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

// How long to wait for the network before falling back to the saved copy.
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Page loads (e.g. from the home screen) are saved as the app shell.
  const key = request.mode === 'navigate' ? 'index.html' : request;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // 'no-cache' revalidates with the server instead of trusting the
      // browser's HTTP cache, which GitHub Pages lets go stale for 10 minutes.
      // Unchanged files come back as a cheap "not modified".
      const network = fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) cache.put(key, response.clone());
        return response;
      });
      // Keep the worker alive until the cache is updated, even if the saved
      // copy is used for this response.
      event.waitUntil(network.catch(() => {}));

      const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
      try {
        const response = await Promise.race([network, timeout]);
        if (response) return response;
      } catch (_) {
        // Offline: fall through to the saved copy.
      }
      const cached = await cache.match(key, { ignoreSearch: true });
      return cached ?? network;
    })(),
  );
});
