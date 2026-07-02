import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotificationCount } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET /api/me/notifications/unread?wallet=<address> — unread count for the nav badge. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  try {
    const count = await getUnreadNotificationCount(wallet);
    return NextResponse.json({ count });
  } catch (err) {
    console.error("GET /api/me/notifications/unread failed:", err);
    return NextResponse.json({ error: "Failed to load count" }, { status: 500 });
  }
}
