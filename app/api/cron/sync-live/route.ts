import { NextRequest, NextResponse } from "next/server";
import { syncLiveFixtures } from "@/lib/txline/sync";
import { requireCronSecret } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";
// Live sync touches a handful of matches; give it headroom on Vercel.
export const maxDuration = 60;

/**
 * Light live sync — hit by the external cron on a short interval for near-real-
 * time scores, goal/kickoff notifications, and pick resolution. Requires
 * `Authorization: Bearer <CRON_SECRET>` and FAILS CLOSED if the secret is unset.
 */
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LIVE_INTERVAL_MS = 15_000; // re-sync cadence while matches are live
const BUDGET_MS = 45_000; // stay under maxDuration (60s) with headroom

async function run(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  try {
    // One external cron hit → several syncs while there's live action, so scores
    // and goal alerts land in ~15s instead of waiting the full cron interval. No
    // extra infra — we just use the function's 60s budget. Idle (no live match)
    // returns after a single quick sync.
    const start = Date.now();
    let result = await syncLiveFixtures();
    let syncs = 1;
    while (result.live > 0 && Date.now() - start < BUDGET_MS) {
      await SLEEP(LIVE_INTERVAL_MS);
      result = await syncLiveFixtures();
      syncs++;
    }
    return NextResponse.json({ ok: true, syncs, ...result });
  } catch (err) {
    console.error("cron sync-live failed:", err);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
