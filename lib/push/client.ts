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

// ─── Explicit opt-out (survives the "permission is still granted" problem) ────
const OPTOUT_KEY = "streakr_push_off";

/** The user explicitly turned push off — don't nag them to turn it back on. */
export function isPushOptedOut(): boolean {
  try { return localStorage.getItem(OPTOUT_KEY) === "1"; } catch { return false; }
}
export function setPushOptedOut(v: boolean): void {
  try { v ? localStorage.setItem(OPTOUT_KEY, "1") : localStorage.removeItem(OPTOUT_KEY); } catch { /* no storage */ }
}

// ─── Native install prompt (Android / desktop Chrome) ─────────────────────────
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let deferredInstall: InstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we drive it ourselves
    deferredInstall = e as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => { deferredInstall = null; });
}

/** True when the browser has offered us a native install prompt to fire. */
export function canInstall(): boolean {
  return deferredInstall !== null;
}

/** Fire the native install prompt. iOS never provides one (manual Share flow). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstall) return "unavailable";
  await deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  return outcome;
}

// ─── The one state every surface asks about ──────────────────────────────────
export type PushState =
  | "unsupported"    // browser can't do Web Push at all
  | "denied"         // OS-blocked — not recoverable in-app
  | "enabled"        // permission granted AND a live subscription
  | "needs-install"  // iOS Safari tab: push is impossible until added to Home Screen
  | "ready";         // can be enabled right now, in one tap

/**
 * Resolve the push state. iOS is checked FIRST because Safari doesn't even expose
 * PushManager outside the installed PWA — it would otherwise look "unsupported"
 * when it's really just "not installed yet".
 */
export async function pushStatus(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) return "enabled";
    } catch { /* fall through to "ready" */ }
  }
  return "ready";
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
  if (!VAPID_PUBLIC) throw new Error("no VAPID key");

  // Request permission FIRST, synchronously within the click. Safari drops the
  // user-gesture context across a long await (e.g. registering the SW), which
  // makes the prompt silently fail — so ask before doing any async work.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  await subscribeAndSave(); // throws a step-tagged error on failure
  return "granted";
}

/** Register the SW, obtain a push subscription, and persist it. Throws an error
 *  tagged with the failing step so the UI can surface exactly what went wrong. */
export async function subscribeAndSave(): Promise<void> {
  let reg: ServiceWorkerRegistration;
  try {
    reg = await registerSW();
  } catch (e) {
    throw new Error(`sw: ${errMsg(e)}`);
  }

  let sub: PushSubscription | null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
  } catch (e) {
    throw new Error(`subscribe: ${errMsg(e)}`);
  }

  try {
    await apiSubscribePush(sub.toJSON());
  } catch (e) {
    throw new Error(`save: ${errMsg(e)}`);
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
