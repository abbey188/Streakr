import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db/queries";
import type { AvatarConfig } from "@/src/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/users
 * Signup: persists a new user with their chosen mascot (avatar). The avatar
 * is saved so it renders for this user AND for others in leaderboards/activity
 * (handoff §4). Idempotent on wallet_address.
 *
 * Body: { walletAddress, username, email?, avatar }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      username?: string;
      email?: string | null;
      avatar?: AvatarConfig;
    };
    if (!body.walletAddress || !body.username || !body.avatar) {
      return NextResponse.json(
        { error: "walletAddress, username and avatar are required" },
        { status: 400 }
      );
    }
    const user = await createUser({
      walletAddress: body.walletAddress,
      username: body.username,
      email: body.email ?? null,
      avatar: body.avatar,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("POST /api/users failed:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
