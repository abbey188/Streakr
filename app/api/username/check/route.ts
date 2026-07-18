import { NextRequest, NextResponse } from "next/server";
import { isUsernameTaken } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,15}$/;

/**
 * GET /api/username/check?u=<name>[&wallet=<self>]  → { available, reason? }
 *
 * Case-insensitive. Pass `wallet` when editing your own profile so your current
 * name doesn't read as taken. `reason`: "invalid" (bad format) | "taken".
 */
export async function GET(req: NextRequest) {
  const u = (req.nextUrl.searchParams.get("u") ?? "").trim();
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;

  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }
  try {
    const taken = await isUsernameTaken(u, wallet || undefined);
    return NextResponse.json({ available: !taken, reason: taken ? "taken" : undefined });
  } catch (err) {
    console.error("GET /api/username/check failed:", err);
    // Fail open — the write path is the authoritative guard (409), so a transient
    // check error should never block a user from trying.
    return NextResponse.json({ available: true });
  }
}
