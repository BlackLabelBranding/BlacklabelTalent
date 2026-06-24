const CACHE_NAME = "blacklabel-talent-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./src/app.js?v=20260624b",
  "./src/styles.css?v=20260624b",
  "./src/brand.css?v=20260624b",
  "./src/live.css?v=20260624b",
  "./src/app-polish.css?v=20260624b",
  "./src/data/mockData.js",
  "./src/lib/hubApi.js?v=20260624b"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match("./index.html"))
    )
  );
});
