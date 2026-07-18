import { NextRequest, NextResponse } from "next/server";
import { toggleFeedReaction } from "@/lib/db/queries";
import { isSquadReaction } from "@/lib/social/reactions";

export const dynamic = "force-dynamic";

/**
 * POST /api/feed/react
 * Toggle a global reaction on a feed moment.
 * Body: { fixtureId, eventKey, emoji, walletAddress }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fixtureId?: string;
      eventKey?: string;
      emoji?: string;
      walletAddress?: string;
    };
    const { fixtureId, eventKey, emoji, walletAddress } = body;
    if (!fixtureId || !eventKey || !emoji || !walletAddress) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    if (!isSquadReaction(emoji)) {
      return NextResponse.json({ error: "invalid emoji" }, { status: 400 });
    }
    await toggleFeedReaction(fixtureId, eventKey, emoji, walletAddress);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/feed/react failed:", err);
    return NextResponse.json({ error: "Failed to react" }, { status: 500 });
  }
}
