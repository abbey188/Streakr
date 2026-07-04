import { NextRequest, NextResponse } from "next/server";
import { makePick } from "@/lib/db/queries";
import { authWallet } from "@/lib/auth/server-auth";
import { getPickWindow } from "@/lib/pick-window";

export const dynamic = "force-dynamic";

/**
 * POST /api/picks
 * Lock or change a pick (allowed until the pick window closes — the first goal,
 * a red card, or the second-half kickoff; see lib/pick-window). Rejected (409)
 * with a `reason` once closed. The window is verified against FRESH live data.
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
    // Verify-only during the bake: logs token health, never rejects. Once
    // AUTH_ENFORCED=true, an unverified caller is rejected here (401) and the
    // wallet comes from the token, not the body.
    const auth = await authWallet(req, body.walletAddress);
    if (!auth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Authoritative pick-window check against fresh live data (anti-exploit).
    const window = await getPickWindow(body.fixtureId);
    if (!window.open) {
      return NextResponse.json(
        { error: "Picks are closed for this match", reason: window.reason },
        { status: 409 }
      );
    }
    const ok = await makePick(auth.wallet, body.fixtureId, body.pick);
    if (!ok) {
      return NextResponse.json({ error: "Pick rejected", reason: "finished" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/picks failed:", err);
    return NextResponse.json({ error: "Failed to save pick" }, { status: 500 });
  }
}
