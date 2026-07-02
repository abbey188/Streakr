import { NextResponse } from "next/server";
import { syncFixtures } from "@/lib/txline/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/txline/sync — pull current TxLINE fixtures into the DB.
 * Called manually now; a cron can hit it on a schedule for continuous sync.
 */
export async function POST() {
  try {
    const result = await syncFixtures();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/txline/sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
