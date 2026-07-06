/* Streakr service worker — PUSH + notification-click ONLY.
 *
 * Deliberately has NO fetch/caching handler: a caching SW is the classic way to
 * brick a web app by serving stale JS/CSS after a deploy. This one only receives
 * push messages and handles taps, so the app itself always loads fresh from the
 * network. Registered by lib/push/client.ts.
 */

// Activate a new version immediately (so SW updates roll out without a stale
// worker lingering).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
