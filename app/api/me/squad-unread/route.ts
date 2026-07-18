import { NextRequest, NextResponse } from "next/server";
import { getSquadUnreadByGroup } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET /api/me/squad-unread?wallet=<address> — unread squad-chat count per squad,
 *  for the Squads nav badge + per-squad + chat-button badges. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  try {
    const counts = await getSquadUnreadByGroup(wallet);
    return NextResponse.json({ counts });
  } catch (err) {
    console.error("GET /api/me/squad-unread failed:", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
