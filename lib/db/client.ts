import { neon } from "@neondatabase/serverless";

/**
 * Neon serverless SQL client.
 *
 * Uses the HTTP driver — one round-trip per query, no connection pool to
 * manage, ideal for Vercel serverless/edge functions (handoff §6, CLAUDE.md
 * "always SuiGrpcClient" analogue: never a long-lived pg pool here).
 *
 * Server-side ONLY. DATABASE_URL is never exposed to the browser.
 *
 * Usage:  const rows = await sql`select * from users where wallet_address = ${addr}`;
 * Tagged-template params are parameterised by the driver — safe from injection.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Fail loud at first use rather than silently returning empty data.
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (local) or the Vercel project env (deployed)."
  );
}

export const sql = neon(databaseUrl);
