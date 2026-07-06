import "server-only";
import webpush from "web-push";
import { sql } from "@/lib/db/client";

/**
 * Server-side Web Push. Phase 1: subscription storage + a sendPush() helper.
 * Nothing calls sendPush automatically yet — that's wired into the notification
 * fan-out in Phase 3. Fully inert until VAPID keys are configured.
 */

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

let configured: boolean | null = null;
/** Configure web-push once from env. Returns false if VAPID keys are absent
 *  (local/sandbox) — sendPush then becomes a no-op instead of throwing. */
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@streakr.click";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/**
 * Send a push to every device a user has subscribed. Best-effort and
 * FAILURE-ISOLATED — never throws, so a push error can't break the caller (e.g.
 * the resolution/notification path). Prunes subscriptions the push service
 * reports as gone (404/410).
 */
export async function sendPush(wallet: string, payload: PushPayload): Promise<void> {
  if (!configure()) return;
  let subs: { endpoint: string; p256dh: string; auth: string }[];
  try {
    subs = (await sql`
      select endpoint, p256dh, auth from push_subscriptions where user_address = ${wallet}
    `) as { endpoint: string; p256dh: string; auth: string }[];
  } catch (e) {
    console.error("[push] load subscriptions failed:", (e as Error)?.message);
    return;
  }
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await deletePushSubscription(s.endpoint).catch(() => {}); // subscription gone
        } else {
          console.error("[push] send failed:", status, (e as Error)?.message);
        }
      }
    })
  );
}

/** Store (or refresh) a browser push subscription for a user. Endpoint is unique. */
export async function savePushSubscription(wallet: string, sub: PushSub): Promise<void> {
  await sql`
    insert into push_subscriptions (user_address, endpoint, p256dh, auth)
    values (${wallet}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    on conflict (endpoint) do update set
      user_address = excluded.user_address,
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `;
}

/** Remove a subscription by its endpoint (unsubscribe, or pruned when dead). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
}
