// ALESIM service worker — push notifications + minimal PWA install/offline support.
// Sub-resource requests (JS/CSS/images/API calls) are left untouched; only page
// navigations get a network-first-with-cache-fallback, so the app installs as a PWA
// and still opens (to the last-seen page) when offline. Keep this handler minimal —
// no precaching of hashed build assets, they'd go stale across deploys.
const SHELL_CACHE = "alesim-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(event.request, response.clone());
        return response;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(event.request)) || (await cache.match("/")) || Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "ALESIM", body: "", url: "/today" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || "alesim",
      data: { url: payload.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          const u = new URL(client.url);
          if (u.pathname === url) {
            await client.focus();
            return;
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
