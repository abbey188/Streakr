import type { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { sql } from "@/lib/db/client";

/**
 * Server-side identity verification (Wave 2 keystone).
 *
 * Routes derive the caller's wallet from their VERIFIED Privy access token, so a
 * request can't act as another user. Flag-gated + reversible:
 *   • AUTH_ENFORCED=false → routes proceed with the client-claimed wallet (as before).
 *   • AUTH_ENFORCED=true  → routes use the token-derived wallet; unverified = rejected.
 */

const APP_ID = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const APP_SECRET = process.env.PRIVY_APP_SECRET || "";

/** Master switch. Only enforce where Privy is actually configured. */
export const AUTH_ENFORCED = process.env.AUTH_ENFORCED === "true" && Boolean(APP_ID && APP_SECRET);

let client: PrivyClient | null = null;
function privy(): PrivyClient | null {
  if (!APP_ID || !APP_SECRET) return null; // unconfigured (local/sandbox) → inert
  if (!client) client = new PrivyClient(APP_ID, APP_SECRET);
  return client;
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() || null : null;
}

/** Verify the caller's Privy access token → Privy user DID. null if invalid/absent/unconfigured. */
export async function verifiedUserId(req: NextRequest): Promise<string | null> {
  const p = privy();
  const token = bearer(req);
  if (!p || !token) return null;
  try {
    const claims = await p.verifyAuthToken(token);
    return claims.userId ?? null;
  } catch (e) {
    console.warn("[auth] verifyAuthToken error:", (e as Error)?.message ?? String(e));
    return null;
  }
}

/** The user's embedded Solana wallet address, straight from Privy (authoritative). */
async function solanaWalletForUser(userId: string): Promise<string | null> {
  const p = privy();
  if (!p) return null;
  try {
    const user = await p.getUser(userId);
    const accounts = (user.linkedAccounts ?? []) as Array<{
      type?: string;
      chainType?: string;
      address?: string;
    }>;
    return accounts.find((a) => a.type === "wallet" && a.chainType === "solana")?.address ?? null;
  } catch {
    return null;
  }
}

/** Bind a Privy userId to a user row once (idempotent — only if currently unbound). */
export async function bindPrivyUser(walletAddress: string, userId: string): Promise<void> {
  await sql`
    update users set privy_user_id = ${userId}
    where wallet_address = ${walletAddress} and privy_user_id is null
  `;
}

/**
 * The authoritative wallet for the caller — verified server-side, SELF-HEALING:
 *   token → userId → (fast) users.privy_user_id → wallet
 *                  → (miss) Privy embedded wallet → bind the row → wallet
 * So a user who signed up after the one-time backfill is bound on their first
 * authed request instead of being rejected. Returns null only if the token is
 * missing/invalid.
 */
export async function getAuthedWallet(req: NextRequest): Promise<string | null> {
  const userId = await verifiedUserId(req);
  if (!userId) return null;

  const rows = (await sql`
    select wallet_address from users where privy_user_id = ${userId} limit 1
  `) as { wallet_address: string }[];
  if (rows[0]) return rows[0].wallet_address;

  // Self-heal: authoritative wallet from Privy; bind the existing row if present.
  const wallet = await solanaWalletForUser(userId);
  if (wallet) await bindPrivyUser(wallet, userId);
  return wallet;
}

/**
 * For signup: the caller's verified userId + authoritative Solana wallet from
 * Privy. Under enforcement the wallet is taken from HERE, not from the client.
 */
export async function resolveFromPrivy(
  req: NextRequest
): Promise<{ userId: string; wallet: string | null } | null> {
  const userId = await verifiedUserId(req);
  if (!userId) return null;
  return { userId, wallet: await solanaWalletForUser(userId) };
}

/**
 * Decide the wallet a request may act as, given the wallet it claims.
 *   • AUTH_ENFORCED=true  → wallet from the verified token (self-healing); reject
 *     if the caller isn't verified.
 *   • AUTH_ENFORCED=false → proceed with the claimed wallet (pre-enforcement).
 */
export async function authWallet(
  req: NextRequest,
  claimed: string
): Promise<{ ok: true; wallet: string } | { ok: false }> {
  if (!AUTH_ENFORCED) return { ok: true, wallet: claimed };
  const wallet = await getAuthedWallet(req);
  return wallet ? { ok: true, wallet } : { ok: false };
}
