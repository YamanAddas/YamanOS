const CACHE_NAME = "yamanos-v0_3-cache";
const CORE = ["./","./index.html","./manifest.webmanifest","./service-worker.js","./os/main.js","./os/registry.js","./os/storage.js","./os/windowManager.js","./os/ui/shell.css"];
const ASSETS = ["./os/assets/icon-180.png","./os/assets/icon-192.png","./os/assets/icon-256.png","./os/assets/icon-512.png","./os/assets/wallpapers/abstract.png","./os/assets/wallpapers/nature.png","./os/assets/wallpapers/horror.png"];
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...CORE, ...ASSETS]);
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (req.method === "GET" && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      const fallback = await cache.match("./index.html");
      return fallback || new Response("Offline", {status: 503});
    }
  })());
});
