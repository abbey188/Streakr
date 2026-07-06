// Send a test Web Push to a user's subscribed devices (Phase 1/2 verification).
// Usage:
//   node --env-file=.env scripts/send-test-push.mjs [walletAddress]
// With no wallet, sends to the MOST RECENTLY subscribed device.
import { neon } from "@neondatabase/serverless";
import webpush from "web-push";

const url = process.env.DATABASE_URL;
const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:support@streakr.click";
if (!url || !pub || !priv) { console.error("Need DATABASE_URL + VAPID_* in env (--env-file=.env)."); process.exit(1); }

const sql = neon(url);
webpush.setVapidDetails(subject, pub, priv);

const wallet = process.argv[2];
const subs = wallet
  ? await sql`select user_address, endpoint, p256dh, auth from push_subscriptions where user_address=${wallet}`
  : await sql`select user_address, endpoint, p256dh, auth from push_subscriptions order by created_at desc limit 1`;

if (subs.length === 0) { console.log("No push subscriptions found. Enable notifications on a device first."); process.exit(0); }

const payload = JSON.stringify({
  title: "🔥 Streakr test",
  body: "Push notifications are working. See you at kickoff!",
  url: "/play",
  tag: "streakr-test",
});

for (const s of subs) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    console.log(`sent -> ${s.user_address.slice(0, 10)}… (${s.endpoint.slice(0, 40)}…)`);
  } catch (e) {
    console.error(`FAILED ${s.user_address.slice(0, 10)}… status=${e?.statusCode} ${e?.body || e?.message}`);
  }
}
