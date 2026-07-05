import { NextRequest, NextResponse } from "next/server";
import { createGroup, getUserGroups, type LeaderboardType } from "@/lib/db/queries";
import { authWallet } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

/** GET /api/groups?wallet=<address> → groups the user belongs to. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const groups = await getUserGroups(wallet);
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("GET /api/groups failed:", err);
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

/**
 * POST /api/groups — create a friend group.
 * Body: { walletAddress, name, emoji }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      walletAddress?: string; name?: string; emoji?: string; leaderboardType?: LeaderboardType;
    };
    if (!body.walletAddress || !body.name?.trim()) {
      return NextResponse.json({ error: "walletAddress and name are required" }, { status: 400 });
    }
    const auth = await authWallet(req, body.walletAddress);
    if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const type: LeaderboardType =
      body.leaderboardType === "points" || body.leaderboardType === "both"
        ? body.leaderboardType
        : "streak";
    const group = await createGroup(auth.wallet, body.name.trim(), body.emoji || "🏆", type);
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("POST /api/groups failed:", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
