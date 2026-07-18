import { NextRequest, NextResponse } from "next/server";
import { updateUserAvatar, UsernameTakenError } from "@/lib/db/queries";
import { authWallet } from "@/lib/auth/server-auth";
import type { AvatarConfig } from "@/src/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/avatar
 * Edit the mascot/avatar from the profile screen. Persisted so the new look
 * propagates to leaderboards/activity everywhere.
 *
 * Body: { walletAddress, avatar }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      avatar?: AvatarConfig;
    };
    if (!body.walletAddress || !body.avatar) {
      return NextResponse.json(
        { error: "walletAddress and avatar are required" },
        { status: 400 }
      );
    }
    const auth = await authWallet(req, body.walletAddress);
    if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const user = await updateUserAvatar(auth.wallet, body.avatar);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    console.error("PATCH /api/users/avatar failed:", err);
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
  }
}
