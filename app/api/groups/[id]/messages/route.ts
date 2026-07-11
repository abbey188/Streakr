import { NextRequest, NextResponse } from "next/server";
import { authWallet } from "@/lib/auth/server-auth";
import { isGroupMember, createGroupMessage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/groups/[id]/messages
 * Post a member message to the Squad Room — a root, or a one-level reply to a
 * message OR a system event. Gated like reactions: verified caller, must be a
 * member. Body is trimmed + length-capped server-side; a supplied parent must
 * belong to the group (checked in createGroupMessage).
 *
 * Body: { walletAddress, body, parentMessageId?, parentEventId? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      body?: string;
      parentMessageId?: string;
      parentEventId?: string;
    };
    if (!body.walletAddress || !body.body || !body.body.trim()) {
      return NextResponse.json(
        { error: "walletAddress and a non-empty body are required" },
        { status: 400 }
      );
    }
    if (body.parentMessageId && body.parentEventId) {
      return NextResponse.json(
        { error: "a reply has one parent, not both" },
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

    const parent = body.parentMessageId
      ? ({ type: "message", id: body.parentMessageId } as const)
      : body.parentEventId
      ? ({ type: "event", id: body.parentEventId } as const)
      : undefined;

    const result = await createGroupMessage(id, auth.wallet, body.body, parent);
    if (!result.ok) {
      return NextResponse.json({ error: "empty message or invalid parent" }, { status: 400 });
    }
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("POST /api/groups/[id]/messages failed:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
