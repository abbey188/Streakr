import { NextRequest, NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/global?wallet=<address>
 * Every signed-up user ranked by streak. `wallet` flags the current user.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  try {
    const leaderboard = await getGlobalLeaderboard(wallet);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("GET /api/leaderboard/global failed:", err);
    return NextResponse.json({ error: "Failed to load global leaderboard" }, { status: 500 });
  }
}
