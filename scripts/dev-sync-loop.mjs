// Local dev convenience: triggers /api/cron/sync-live every 60s so the DB stays
// fresh while you test (production uses cron-job.org for this). The endpoint
// requires the CRON_SECRET bearer, which this reads from .env.local.
//
//   node scripts/dev-sync-loop.mjs      (run alongside `npm run dev`)
//
// Stop with Ctrl+C.
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const secret = env.match(/CRON_SECRET="?([^"\n]+)"?/)?.[1] || "";
const url = "http://localhost:3000/api/cron/sync-live";
const INTERVAL_MS = 60_000;

async function tick() {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.json();
    console.log(new Date().toLocaleTimeString(), res.status, JSON.stringify(body));
  } catch (err) {
    console.log(new Date().toLocaleTimeString(), "sync error:", err.message);
  }
}

console.log(`dev sync loop → ${url} every ${INTERVAL_MS / 1000}s (Ctrl+C to stop)`);
await tick();
setInterval(tick, INTERVAL_MS);
