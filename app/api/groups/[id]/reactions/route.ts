import { NextRequest, NextResponse } from "next/server";
import { authWallet } from "@/lib/auth/server-auth";
import { isGroupMember, toggleGroupReaction } from "@/lib/db/queries";
import { isSquadReaction } from "@/lib/social/reactions";

export const dynamic = "force-dynamic";

/**
 * POST /api/groups/[id]/reactions
 * Toggle a reaction on a squad item. First WRITE in the Squad Room, so it's
 * gated: the caller's wallet is verified (authWallet) and must be a member of
 * the group. The emoji must be in the fixed set; the target must belong to the
 * group (checked in toggleGroupReaction).
 *
 * Body: { walletAddress, targetType: "message"|"event", targetId, emoji }
 * Returns: { added: boolean, reactions: SquadReaction[] } — the target's fresh
 * summary, for the client to reconcile its optimistic update.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      targetType?: string;
      targetId?: string;
      emoji?: string;
    };
    if (
      !body.walletAddress ||
      (body.targetType !== "message" && body.targetType !== "event") ||
      !body.targetId ||
      !body.emoji ||
      !isSquadReaction(body.emoji)
    ) {
      return NextResponse.json(
        { error: "walletAddress, targetType ('message'|'event'), targetId and a valid emoji are required" },
        { status: 400 }
      );
    }

    const auth = await authWallet(req, body.walletAddress);
    if (!auth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!(await isGroupMember(id, auth.wallet))) {
      return NextResponse.json({ error: "not a member of this group" }, { status: 403 });
    }

    const result = await toggleGroupReaction(
      id,
      auth.wallet,
      body.targetType,
      body.targetId,
      body.emoji
    );
    if (!result.ok) {
      return NextResponse.json({ error: "target not found in this group" }, { status: 404 });
    }
    return NextResponse.json({ added: result.added, reactions: result.reactions });
  } catch (err) {
    console.error("POST /api/groups/[id]/reactions failed:", err);
    return NextResponse.json({ error: "Failed to react" }, { status: 500 });
  }
}
