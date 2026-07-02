import { NextRequest, NextResponse } from "next/server";
import { getUserByWallet } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/me?wallet=<address>
 * Returning-user check. Drives the auth fork (handoff §3.4):
 *   - user present  → returning user → straight to Home (mascot/streak/PB rehydrated)
 *   - user === null → first-time user → Identity → Tour
 *
 * Session-based auth replaces the wallet query param in todo #8; the shape
 * returned here stays the same.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const user = await getUserByWallet(wallet);
    return NextResponse.json({ user }); // user may be null (new user)
  } catch (err) {
    console.error("GET /api/me failed:", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
