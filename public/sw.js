/* Streakr service worker — PUSH + notification-click, and NO caching of app
 * assets.
 *
 * A caching SW is the classic way to brick a web app by serving stale JS/CSS
 * after a deploy, so app requests always fall through to the network. The ONLY
 * exception is country-flag images (flagcdn) — immutable, cross-origin, and not
 * app code — which are cache-first so they don't re-download and flash on every
 * client-side navigation. Registered by lib/push/client.ts.
 */

// Activate a new version immediately (so SW updates roll out without a stale
// worker lingering).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Fetch handler. Chrome's install criteria require a registered service worker
// WITH a fetch handler before it offers "Install app". App requests fall through
// untouched (no respondWith → normal network → no stale-asset risk). The ONE
// exception: country-flag images are served cache-first — they're immutable and
// cross-origin, so caching them can't brick the app, and it stops the flags from
// re-downloading (and flashing) on every page navigation.
self.addEventListener("fetch", (event) => {
  if (event.request.url.startsWith("https://flagcdn.com/")) {
    event.respondWith(
      caches.open("streakr-flags-v1").then((cache) =>
        cache.match(event.request).then(
          (hit) =>
            hit ||
            fetch(event.request).then((res) => {
              cache.put(event.request, res.clone());
              return res;
            })
        )
      )
    );
  }
  // else: pass through — nothing else is ever cached.
});

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
