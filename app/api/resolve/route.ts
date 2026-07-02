import { NextResponse } from "next/server";
import { resolveFinishedFixtures } from "@/lib/db/resolution";

export const dynamic = "force-dynamic";

/**
 * POST /api/resolve — resolve finished fixtures into picks/streaks/badges/
 * notifications without re-pulling fixtures. Idempotent; safe as a cron.
 */
export async function POST() {
  try {
    const result = await resolveFinishedFixtures();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/resolve failed:", err);
    return NextResponse.json({ error: "Resolution failed" }, { status: 500 });
  }
}
