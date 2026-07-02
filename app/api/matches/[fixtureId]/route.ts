import { NextRequest, NextResponse } from "next/server";
import { getTxlineProvider } from "@/lib/txline";
import { getTeamForm } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/matches/[fixtureId]
 * Full match detail (score + timeline + stats) from TxLINE, plus each team's
 * last-5 form from our synced fixture history.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  try {
    const detail = await getTxlineProvider().getMatchDetail(fixtureId);
    if (!detail) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    const [formA, formB] = await Promise.all([
      getTeamForm(detail.teamA.id).catch(() => []),
      getTeamForm(detail.teamB.id).catch(() => []),
    ]);
    return NextResponse.json({ detail, formA, formB });
  } catch (err) {
    console.error("GET /api/matches/[fixtureId] failed:", err);
    return NextResponse.json({ error: "Failed to load match" }, { status: 500 });
  }
}
