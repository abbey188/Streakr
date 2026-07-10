// Fire ONE group notification at a single account, using the exact payload
// emitGroupEvent() builds — inbox row + Web Push.
//
// Deliberately does NOT call emitGroupEvent(): that fans out to every member of
// the actor's groups and posts to the group feed, which would spam real users
// just to test a code path.
//
// Usage:
//   node --env-file=.env scripts/test-group-push.mjs <walletAddress>
//   node --env-file=.env scripts/test-group-push.mjs <walletAddress> --clean
import { neon } from "@neondatabase/serverless";
import webpush from "web-push";

const url = process.env.DATABASE_URL;
const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:support@streakr.click";
if (!url || !pub || !priv) { console.error("Need DATABASE_URL + VAPID_* (--env-file=.env)."); process.exit(1); }

const sql = neon(url);
webpush.setVapidDetails(subject, pub, priv);

const TEST_PREFIX = "TEST-GROUP:";
const address = process.argv[2];
if (!address) { console.error("usage: test-group-push.mjs <walletAddress> [--clean]"); process.exit(1); }

if (process.argv.includes("--clean")) {
  const gone = await sql`
    delete from notifications
    where user_address = ${address} and type = 'group' and dedup_key like ${TEST_PREFIX + "%"}
    returning id`;
  console.log(`removed ${gone.length} test notification(s)`);
  process.exit(0);
}

// Mirrors emitGroupEvent(): title/body/icon/url and a stable dedup_key.
const title = "From your group";
const body = "@CleanSheet99 hit a 5-match streak! 🔥";
const icon = "🔥";
const dedupKey = `${TEST_PREFIX}${Date.now()}`;

const [row] = await sql`
  insert into notifications (user_address, type, title, body, icon, dedup_key)
  values (${address}, 'group', ${title}, ${body}, ${icon}, ${dedupKey})
  returning id, created_at`;
console.log("inbox row:", row.id, row.created_at);

const subs = await sql`
  select endpoint, p256dh, auth from push_subscriptions where user_address = ${address}`;
if (!subs.length) { console.log("\n⚠ no push subscriptions — inbox row only, no device push."); process.exit(0); }

const payload = JSON.stringify({ title, body, icon, url: "/inbox", tag: "streakr-group-test" });
for (const s of subs) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    console.log(`sent -> ${s.endpoint.slice(0, 48)}…`);
  } catch (e) {
    console.error(`FAILED status=${e?.statusCode} ${e?.body || e?.message}`);
  }
}
