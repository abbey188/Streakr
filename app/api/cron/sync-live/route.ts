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
async function run(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  try {
    const result = await syncLiveFixtures();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("cron sync-live failed:", err);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
