import type { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { sql } from "@/lib/db/client";

/**
 * Server-side identity verification (Wave 2 keystone).
 *
 * The app currently trusts a client-supplied `walletAddress`. This module lets a
 * route instead derive the caller's wallet from their VERIFIED Privy access token,
 * so a request can't act as another user. Rollout is staged and reversible:
 *
 *   • AUTH_ENFORCED=false (default) → routes keep using the body wallet; these
 *     helpers can run in "verify + backfill" mode without rejecting anyone.
 *   • AUTH_ENFORCED=true            → routes use getAuthedWallet() and reject
 *     unverified callers.
 *
 * Nothing imports this yet — it is inert until routes are migrated one at a time.
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
  if (!p) {
    console.warn("[auth] privy client unconfigured (APP_ID/SECRET missing in this env)");
    return null;
  }
  if (!token) return null; // caller logs whether a bearer header was present
  try {
    const claims = await p.verifyAuthToken(token);
    return claims.userId ?? null;
  } catch (e) {
    console.warn("[auth] verifyAuthToken error:", (e as Error)?.message ?? String(e));
    return null;
  }
}

/**
 * The authoritative wallet for the caller — verified server-side.
 * Fast path only: token → userId → users.privy_user_id → wallet_address (one
 * indexed read, no Privy API call). Returns null if unverified or not yet mapped;
 * the caller decides what to do (public route, or resolveFromPrivy at signup).
 */
export async function getAuthedWallet(req: NextRequest): Promise<string | null> {
  const userId = await verifiedUserId(req);
  if (!userId) return null;
  const rows = (await sql`
    select wallet_address from users where privy_user_id = ${userId} limit 1
  `) as { wallet_address: string }[];
  return rows[0]?.wallet_address ?? null;
}

/**
 * Resolve the caller's Solana wallet directly from Privy — for signup and for the
 * one-time bind of existing users (before a privy_user_id mapping exists). Makes a
 * Privy API call, so use only on infrequent paths (signup / first authed touch).
 */
export async function resolveFromPrivy(
  req: NextRequest
): Promise<{ userId: string; wallet: string | null } | null> {
  const p = privy();
  const userId = await verifiedUserId(req);
  if (!p || !userId) return null;
  try {
    const user = await p.getUser(userId);
    const accounts = (user.linkedAccounts ?? []) as Array<{
      type?: string;
      chainType?: string;
      address?: string;
    }>;
    const wallet =
      accounts.find((a) => a.type === "wallet" && a.chainType === "solana")?.address ?? null;
    return { userId, wallet };
  } catch {
    return { userId, wallet: null };
  }
}

/**
 * Bind a Privy userId to a user row once (idempotent). Used during rollout to
 * backfill existing users the first time they make a verified request.
 */
export async function bindPrivyUser(walletAddress: string, userId: string): Promise<void> {
  await sql`
    update users set privy_user_id = ${userId}
    where wallet_address = ${walletAddress} and privy_user_id is null
  `;
}

/**
 * Decide the wallet a request may act as, given the wallet it CLAIMS in its body.
 *
 *  • AUTH_ENFORCED=true  → the wallet is taken from the verified token; if the
 *    caller isn't verified/mapped, the request is rejected ({ ok: false }).
 *  • AUTH_ENFORCED=false → "verify-only" bake: we log whether the token verified
 *    and whether it matches the claimed wallet, but we NEVER reject — the request
 *    proceeds with the claimed wallet exactly as before. This lets us confirm
 *    tokens resolve correctly for real users before switching enforcement on.
 */
export async function authWallet(
  req: NextRequest,
  claimed: string
): Promise<{ ok: true; wallet: string } | { ok: false }> {
  const rawAuth = req.headers.get("authorization") ?? "";
  const hasBearer = rawAuth.startsWith("Bearer ");

  // Verify once, then resolve the mapped wallet — so we can log each link.
  const userId = await verifiedUserId(req);
  let verified: string | null = null;
  if (userId) {
    const rows = (await sql`
      select wallet_address from users where privy_user_id = ${userId} limit 1
    `) as { wallet_address: string }[];
    verified = rows[0]?.wallet_address ?? null;
  }

  if (AUTH_ENFORCED) {
    return verified ? { ok: true, wallet: verified } : { ok: false };
  }

  // Verify-only observability — never rejects. Persist to a debug table so we can
  // read the exact break (client header / token verify / mapping) reliably.
  try {
    await sql`
      insert into auth_debug (wallet, has_bearer, token_len, user_id, verified_wallet)
      values (${claimed}, ${hasBearer}, ${rawAuth.length}, ${userId}, ${verified})
    `;
  } catch {
    /* debug write must never affect the request */
  }
  return { ok: true, wallet: claimed };
}
