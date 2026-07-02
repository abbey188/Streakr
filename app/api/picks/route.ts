import { NextRequest, NextResponse } from "next/server";
import { makePick } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/picks
 * Lock or change a pick. Rejected (409) once the fixture is no longer
 * 'upcoming' — picks freeze at kickoff so streaks can't be gamed.
 *
 * Body: { walletAddress, fixtureId, pick: "A" | "B" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      fixtureId?: string;
      pick?: "A" | "B";
    };
    if (!body.walletAddress || !body.fixtureId || (body.pick !== "A" && body.pick !== "B")) {
      return NextResponse.json(
        { error: "walletAddress, fixtureId and pick ('A'|'B') are required" },
        { status: 400 }
      );
    }
    const ok = await makePick(body.walletAddress, body.fixtureId, body.pick);
    if (!ok) {
      return NextResponse.json(
        { error: "Pick rejected — match already kicked off" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/picks failed:", err);
    return NextResponse.json({ error: "Failed to save pick" }, { status: 500 });
  }
}
