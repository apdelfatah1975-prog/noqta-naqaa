const CACHE_NAME = "purepoint-shell-v18-technician-isolated";
const APP_SHELL = ["/",

  "/technician-preview",
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
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedRoute = requestUrl.pathname === "/" ? undefined : await cache.match(event.request);
      const cachedGlobalPath = await caches.match(requestUrl.pathname);
      const cachedPath = await cache.match(requestUrl.pathname);
      const cachedShell = cachedPath || cachedRoute || (requestUrl.pathname === "/" ? undefined : cachedGlobalPath);

      const refresh = fetch(event.request).then(response => {
        if (response.ok) {
          void cache.put(event.request, response.clone());
          if (requestUrl.pathname === "/") void cache.put("/", response.clone());
        }
        return response;
      }).catch(() => cachedShell || caches.match("/offline.html"));

      // عند الاتصال، اعرض النسخة الجديدة فورًا وحدّث الكاش؛ استخدم الكاش فقط عند انقطاع الشبكة.
      return refresh.catch(() => cachedShell || caches.match("/offline.html"));
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const refresh = fetch(event.request).then(response => {
        if (response.ok) {
          void caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
      return cached || refresh;
    }),
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
