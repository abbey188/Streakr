import { NextRequest, NextResponse } from "next/server";
import { createUser, UsernameTakenError } from "@/lib/db/queries";
import { resolveFromPrivy, bindPrivyUser, AUTH_ENFORCED } from "@/lib/auth/server-auth";
import type { AvatarConfig } from "@/src/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/users
 * Signup: persists a new user with their chosen mascot (avatar). Idempotent on
 * wallet_address. The caller's identity is resolved from their verified Privy
 * token and bound (privy_user_id) so they're mapped for server-side auth. When
 * AUTH_ENFORCED, the wallet is taken from Privy — never the client body.
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
    if (!body.username || !body.avatar) {
      return NextResponse.json(
        { error: "username and avatar are required" },
        { status: 400 }
      );
    }

    // Under enforcement, take the authoritative wallet from the VERIFIED Privy
    // token (never the client body). When enforcement is OFF we skip these Privy
    // network round-trips entirely — the privy_user_id binding self-heals on the
    // first authed request once enforcement is switched on (see getAuthedWallet).
    let wallet = body.walletAddress;
    let userId: string | undefined;
    if (AUTH_ENFORCED) {
      const identity = await resolveFromPrivy(req);
      if (!identity?.wallet) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      wallet = identity.wallet; // ignore the client-claimed wallet under enforcement
      userId = identity.userId;
    }
    if (!wallet) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const user = await createUser({
      walletAddress: wallet,
      username: body.username,
      email: body.email ?? null,
      avatar: body.avatar,
    });
    if (userId) await bindPrivyUser(wallet, userId);

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    console.error("POST /api/users failed:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
