import { NextRequest, NextResponse } from "next/server";
import { updateUserAvatar } from "@/lib/db/queries";
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
    const user = await updateUserAvatar(body.walletAddress, body.avatar);
    return NextResponse.json({ user });
  } catch (err) {
    console.error("PATCH /api/users/avatar failed:", err);
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
  }
}
