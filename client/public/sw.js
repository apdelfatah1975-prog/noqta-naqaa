const CACHE_NAME = "purepoint-shell-v12";
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/app-icon.svg"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches
        .keys()
        .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    ]),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // API calls must reach the application so its local offline fallbacks can run.
  if (requestUrl.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => {
            void cache.put(event.request, copy);
            if (requestUrl.pathname !== "/") {
              void cache.put("/", response.clone());
            }
          });
          return response;
        })
        .catch(async () => {
          return (await caches.match(requestUrl.pathname)) || (await caches.match("/")) || (await caches.match("/offline.html"));
        }),
    );
    return;
  }

  // Cache-first for the built application assets. This is what allows the
  // React app to boot after the device loses connectivity.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
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
