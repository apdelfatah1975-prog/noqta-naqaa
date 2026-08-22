const CACHE_NAME = "purepoint-shell-v19";
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/technician-manifest.webmanifest",
  "/app-icon.svg",
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    ]),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) {
          await cache.put(event.request, response.clone());
          if (requestUrl.pathname === "/") await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await cache.match(event.request)) || (await cache.match("/")) || (await cache.match("/offline.html"));
      }
    })());
    return;
  }

  // Never let an old hashed JS/CSS asset block a newly deployed application.
  if (requestUrl.pathname.startsWith("/assets/") || requestUrl.pathname.endsWith(".js") || requestUrl.pathname.endsWith(".css")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

self.addEventListener("sync", event => {
  if (event.tag !== "purepoint-offline-sync") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(openClients => {
      openClients.forEach(client => client.postMessage({ type: "purepoint-offline-sync-request" }));
    }),
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/reminders";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(openClients => {
      const matchingClient = openClients.find(client => new URL(client.url).origin === self.location.origin);
      if (matchingClient) return matchingClient.focus().then(() => matchingClient.navigate(targetUrl));
      return clients.openWindow(targetUrl);
    }),
  );
});
