import { NextRequest, NextResponse } from "next/server";
import { authWallet } from "@/lib/auth/server-auth";
import { isGroupMember, createGroupMessage, recentMessageCount } from "@/lib/db/queries";
import { notifySquadReply } from "@/lib/db/squad-notify";
import type { MomentAttachment } from "@/src/types";

export const dynamic = "force-dynamic";

// Simple per-user flood guard: at most RATE_MAX messages per RATE_WINDOW seconds.
const RATE_MAX = 20;
const RATE_WINDOW = 60;

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
      attachment?: MomentAttachment | null;
    };
    // A shared moment can post with no text, so a body is required only when
    // there's no attachment.
    const hasAttachment = body.attachment?.kind === "moment";
    if (!body.walletAddress || ((!body.body || !body.body.trim()) && !hasAttachment)) {
      return NextResponse.json(
        { error: "walletAddress and a non-empty body (or an attachment) are required" },
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
    if ((await recentMessageCount(auth.wallet, RATE_WINDOW)) >= RATE_MAX) {
      return NextResponse.json(
        { error: "You're sending messages too fast — give it a moment." },
        { status: 429 }
      );
    }

    const parent = body.parentMessageId
      ? ({ type: "message", id: body.parentMessageId } as const)
      : body.parentEventId
      ? ({ type: "event", id: body.parentEventId } as const)
      : undefined;

    const result = await createGroupMessage(
      id, auth.wallet, body.body ?? "", parent, hasAttachment ? body.attachment : null
    );
    if (!result.ok) {
      return NextResponse.json({ error: "empty message or invalid parent" }, { status: 400 });
    }
    // Phase 4: a reply pings whoever it's aimed at (best-effort, never throws).
    if (parent && result.id) {
      await notifySquadReply(auth.wallet, body.body ?? "", parent, result.id);
    }
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("POST /api/groups/[id]/messages failed:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
