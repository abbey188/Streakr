import { NextRequest, NextResponse } from "next/server";
import { syncLiveFixtures } from "@/lib/txline/sync";

export const dynamic = "force-dynamic";
// Live sync touches a handful of matches; give it headroom on Vercel.
export const maxDuration = 60;

/**
 * Light live sync — designed to be hit by a Vercel Cron on a short interval for
 * near-real-time scores, goal/kickoff notifications, and pick resolution.
 * If CRON_SECRET is set, requests must send `Authorization: Bearer <secret>`
 * (Vercel Cron does this automatically).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
