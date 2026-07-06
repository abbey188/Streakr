import { apiSubscribePush, apiUnsubscribePush } from "@/lib/api/client";

/**
 * Client-side Web Push helpers: register the service worker, request permission,
 * subscribe, and persist the subscription server-side. The permission UX
 * (buttons, iOS install-first flow) lives in Phase 2 and calls enablePush() from
 * a user gesture.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Running as an installed PWA (standalone)? Needed for iOS, where push works
 *  ONLY from the home-screen app, never a Safari tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag for home-screen apps.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as Mac; disambiguate via touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Register the SW, request notification permission, subscribe, and store the
 * subscription. Must be called from a user gesture (browser requirement).
 * Returns the resulting permission ("granted" on success).
 */
export async function enablePush(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  if (!VAPID_PUBLIC) throw new Error("Push not configured");

  const reg = await registerSW();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  await apiSubscribePush(sub.toJSON());
  return "granted";
}

/** Unsubscribe locally and remove the subscription server-side. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await apiUnsubscribePush(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
