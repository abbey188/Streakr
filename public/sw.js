/* Streakr service worker — PUSH + notification-click, and NO caching.
 *
 * A caching SW is the classic way to brick a web app by serving stale JS/CSS
 * after a deploy, so nothing here ever answers a request: the app always loads
 * fresh from the network. The fetch listener below exists purely to satisfy
 * Chrome's installability check — see the note above it before touching it.
 * Registered by lib/push/client.ts.
 */

// Activate a new version immediately (so SW updates roll out without a stale
// worker lingering).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// PASS-THROUGH fetch handler. Chrome's install criteria require a registered
// service worker WITH a fetch handler before it will offer "Install app". This
// listener deliberately never calls event.respondWith(), so every request falls
// through to the normal network — nothing is cached, and the stale-asset failure
// mode a caching SW would introduce stays impossible.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Streakr", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Streakr";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag, // collapse duplicates of the same event
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an already-open Streakr tab if there is one; else open a new one.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && url) client.navigate(url).catch(() => {});
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
