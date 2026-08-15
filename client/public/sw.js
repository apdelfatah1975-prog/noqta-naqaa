const CACHE_NAME = "purepoint-shell-v2";
const APP_SHELL = ["/offline.html", "/manifest.webmanifest", "/app-icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
      return response;
    }).catch(() => caches.match("/").then(response => response || caches.match("/offline.html"))));
    return;
  }
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/src/") || requestUrl.pathname.startsWith("/@")) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/reminders";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(openClients => {
    const matchingClient = openClients.find(client => new URL(client.url).origin === self.location.origin);
    if (matchingClient) return matchingClient.focus().then(() => matchingClient.navigate(targetUrl));
    return clients.openWindow(targetUrl);
  }));
});
