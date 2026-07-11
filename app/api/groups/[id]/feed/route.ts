import { NextRequest, NextResponse } from "next/server";
import { authWallet } from "@/lib/auth/server-auth";
import { getSquadFeed, isGroupMember } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id]/feed?wallet=<address> → SquadItem[]
 * The merged Squad Room timeline: system match-events + member messages, each
 * with reactions and one level of replies.
 *
 * Unlike /activity and /leaderboard, this is MEMBERS-ONLY: a squad chat is
 * private, so the caller must be signed in and a member of the group. (Fully
 * enforced once AUTH_ENFORCED is on; until then the membership check still keeps
 * out anyone not claiming a member wallet.)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const auth = await authWallet(req, wallet);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isGroupMember(id, auth.wallet))) {
    return NextResponse.json({ error: "not a member of this group" }, { status: 403 });
  }
  try {
    const feed = await getSquadFeed(id, auth.wallet);
    return NextResponse.json({ feed });
  } catch (err) {
    console.error("GET /api/groups/[id]/feed failed:", err);
    return NextResponse.json({ error: "Failed to load squad feed" }, { status: 500 });
  }
}
