const CACHE_NAME = "pocket-deck-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

const GOOGLE_FONTS_ORIGIN = "https://fonts.googleapis.com";
const GOOGLE_FONTS_STATIC_ORIGIN = "https://fonts.gstatic.com";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Pages and the content files are network-first: that's how app updates and new meals
  // arrive. They fall back to the cached copy offline. Everything else is a hashed build
  // asset (immutable), so cache-first is safe and fast.
  const isPage = request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || /\/content\/.*\.json$/.test(url.pathname);
  if (url.origin === location.origin && isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  if (url.origin === GOOGLE_FONTS_ORIGIN || url.origin === GOOGLE_FONTS_STATIC_ORIGIN) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then(
          (response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          },
          () => cached
        );
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});