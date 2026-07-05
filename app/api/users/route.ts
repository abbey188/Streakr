import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db/queries";
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

    // Authoritative identity from Privy (userId + embedded Solana wallet).
    const identity = await resolveFromPrivy(req);
    let wallet = body.walletAddress;
    if (AUTH_ENFORCED) {
      if (!identity?.wallet) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      wallet = identity.wallet; // ignore the client-claimed wallet under enforcement
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
    // Map this user for future auth (idempotent; also fixes the "new user unmapped" gap).
    if (identity?.userId) await bindPrivyUser(wallet, identity.userId);

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("POST /api/users failed:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
