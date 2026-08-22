const CACHE_NAME = "purepoint-technician-orders-v2";
const SCOPE_PREFIX = "/technician-app/";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME && key.includes("technician"))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("sync", event => {
  if (event.tag !== "purepoint-offline-sync") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(openClients => {
      openClients.forEach(client => client.postMessage({ type: "purepoint-offline-sync-request" }));
    }),
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && new URL(request.url).pathname.startsWith(SCOPE_PREFIX)) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("/technician-app/login")))
  );
});
