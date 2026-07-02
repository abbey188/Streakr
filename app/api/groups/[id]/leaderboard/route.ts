import { NextRequest, NextResponse } from "next/server";
import { getGroupLeaderboard } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id]/leaderboard?wallet=<address>
 * Returns GroupMember[] ranked by streak. `wallet` flags the current user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  try {
    const leaderboard = await getGroupLeaderboard(id, wallet);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("GET /api/groups/[id]/leaderboard failed:", err);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
