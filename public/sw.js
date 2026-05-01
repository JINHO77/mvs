// MVS Service Worker
// Phase 1: install/activate skeleton + push notification scaffolding for Phase 2.
// No precaching yet — kept intentionally minimal so it cannot break navigation.

const SW_VERSION = "mvs-sw-v1";

self.addEventListener("install", (event) => {
  // Activate this SW immediately on first install (no waiting on old tabs).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push delivery (used by Phase 2 once VAPID keys + subscriptions exist)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "MVS", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "MVS";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || `mvs-${Date.now()}`,
    requireInteraction: false,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              client.navigate(targetUrl);
            } catch (_) {
              // ignore navigate failures (cross-origin etc.)
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
