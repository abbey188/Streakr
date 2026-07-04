import { NextRequest, NextResponse } from "next/server";
import { resolveFinishedFixtures } from "@/lib/db/resolution";
import { requireCronSecret } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/resolve — resolve finished fixtures into picks/streaks/badges/
 * notifications without re-pulling fixtures. Idempotent; safe as a cron.
 * Protected: writes user stats, so it requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  try {
    const result = await resolveFinishedFixtures();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/resolve failed:", err);
    return NextResponse.json({ error: "Resolution failed" }, { status: 500 });
  }
}
