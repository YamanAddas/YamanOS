const CACHE = "tabletos-20260201111047";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./os/os.css",
  "./os/os.js",
  "./apps/native/notes.js",
  "./apps/native/calculator.js",
  "./apps/native/minesweeper.js",
  "./apps/native/solitaire.js",
  "./apps/native/spider.js",
  "./apps/native/mahjong.js",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-256.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k===CACHE) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

// Cache-first for same-origin assets, network-first for cross-origin.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if(url.origin === location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if(cached) return cached;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    })());
  } else {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return new Response("Offline. External content unavailable.", {
          status: 200,
          headers: {"Content-Type":"text/plain"}
        });
      }
    })());
  }
});
