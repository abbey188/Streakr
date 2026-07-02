import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET /api/me/badges?wallet=<address> — the badge ids the user has earned. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const badgeIds = await getUserBadges(wallet);
    return NextResponse.json({ badgeIds });
  } catch (err) {
    console.error("GET /api/me/badges failed:", err);
    return NextResponse.json({ error: "Failed to load badges" }, { status: 500 });
  }
}
