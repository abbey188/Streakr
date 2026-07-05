import { NextRequest, NextResponse } from "next/server";
import { getUserByWallet } from "@/lib/db/queries";
import { getAuthedWallet } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me?wallet=<address>
 * Returning-user check that drives the auth fork (returning → Home, null → Tour).
 *
 * PII: the email is only returned to the VERIFIED owner (the caller's token wallet
 * must equal the requested wallet). Otherwise it's stripped — closes the email-
 * disclosure leak where anyone could read any user's email by wallet.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const user = await getUserByWallet(wallet);
    if (user && user.email) {
      const callerWallet = await getAuthedWallet(req);
      if (callerWallet !== wallet) user.email = null; // not the owner → hide email
    }
    return NextResponse.json({ user }); // user may be null (new user)
  } catch (err) {
    console.error("GET /api/me failed:", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
