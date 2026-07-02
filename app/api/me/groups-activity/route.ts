import { NextRequest, NextResponse } from "next/server";
import { getMyGroupsActivity } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/groups-activity?wallet=<address>
 * Milestone activity from all groups the user belongs to (Inbox group feed).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const activity = await getMyGroupsActivity(wallet);
    return NextResponse.json({ activity });
  } catch (err) {
    console.error("GET /api/me/groups-activity failed:", err);
    return NextResponse.json({ error: "Failed to load group activity" }, { status: 500 });
  }
}
