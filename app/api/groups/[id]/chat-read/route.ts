import { NextRequest, NextResponse } from "next/server";
import { markSquadGroupRead } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** POST /api/groups/[id]/chat-read  { walletAddress }
 *  Marks this squad's chat notifications read — called when the user opens the
 *  Squad Room, so its unread badges clear. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { walletAddress?: string };
    if (!body.walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }
    await markSquadGroupRead(body.walletAddress, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/groups/[id]/chat-read failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
