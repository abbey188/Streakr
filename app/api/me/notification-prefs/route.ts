import { NextRequest, NextResponse } from "next/server";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/db/queries";
import { authWallet } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

/** GET /api/me/notification-prefs?wallet=<address> */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  try {
    const prefs = await getNotificationPrefs(wallet);
    return NextResponse.json({ prefs });
  } catch (err) {
    console.error("GET /api/me/notification-prefs failed:", err);
    return NextResponse.json({ error: "Failed to load prefs" }, { status: 500 });
  }
}

/** PATCH /api/me/notification-prefs  { walletAddress, prefs } */
export async function PATCH(req: NextRequest) {
  let body: { walletAddress?: string; prefs?: Record<string, boolean> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.walletAddress || typeof body.prefs !== "object" || body.prefs === null) {
    return NextResponse.json({ error: "walletAddress and prefs required" }, { status: 400 });
  }
  const auth = await authWallet(req, body.walletAddress);
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const prefs = await updateNotificationPrefs(auth.wallet, body.prefs);
    return NextResponse.json({ prefs });
  } catch (err) {
    console.error("PATCH /api/me/notification-prefs failed:", err);
    return NextResponse.json({ error: "Failed to update prefs" }, { status: 500 });
  }
}
