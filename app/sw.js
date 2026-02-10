const CACHE_NAME = "koedeam-app-v0.0.1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-32.png",
  "./assets/icon-64.png",
  "./assets/icon-128.png",
  "./assets/icon-256.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      return res;
    } catch {
      // offline fallback for navigation
      if (req.mode === "navigate") {
        const cachedIndex = await caches.match("./index.html");
        if (cachedIndex) return cachedIndex;
      }
      throw new Error("offline");
    }
  })());
});
