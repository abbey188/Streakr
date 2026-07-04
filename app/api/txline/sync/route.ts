import { NextRequest, NextResponse } from "next/server";
import { syncFixtures } from "@/lib/txline/sync";
import { requireCronSecret } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";
// Full sync fans a scores call per fixture — heavy. Give it headroom.
export const maxDuration = 300;

/**
 * POST /api/txline/sync — pull current TxLINE fixtures into the DB (FULL sync).
 * Protected: this is an expensive internal/admin operation, not public. Requires
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  try {
    const result = await syncFixtures();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/txline/sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
