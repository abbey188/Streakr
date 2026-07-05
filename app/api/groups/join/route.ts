import { NextRequest, NextResponse } from "next/server";
import { joinGroup } from "@/lib/db/queries";
import { authWallet } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/groups/join — join a friend group by invite code.
 * Body: { walletAddress, inviteCode }. 404 if the code is invalid.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { walletAddress?: string; inviteCode?: string };
    if (!body.walletAddress || !body.inviteCode?.trim()) {
      return NextResponse.json({ error: "walletAddress and inviteCode are required" }, { status: 400 });
    }
    const auth = await authWallet(req, body.walletAddress);
    if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const group = await joinGroup(auth.wallet, body.inviteCode.trim());
    if (!group) {
      return NextResponse.json({ error: "No group found for that code" }, { status: 404 });
    }
    return NextResponse.json({ group });
  } catch (err) {
    console.error("POST /api/groups/join failed:", err);
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
}
