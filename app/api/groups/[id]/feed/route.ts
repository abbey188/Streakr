import { NextRequest, NextResponse } from "next/server";
import { getSquadFeed } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id]/feed?wallet=<address> → SquadItem[]
 * The merged Squad Room timeline: system match-events + member messages, each
 * with reactions and one level of replies. `wallet` flags the viewer's own
 * reactions/messages. Read is open, matching /activity and /leaderboard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  try {
    const feed = await getSquadFeed(id, wallet);
    return NextResponse.json({ feed });
  } catch (err) {
    console.error("GET /api/groups/[id]/feed failed:", err);
    return NextResponse.json({ error: "Failed to load squad feed" }, { status: 500 });
  }
}
