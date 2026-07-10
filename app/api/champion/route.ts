import { NextRequest, NextResponse } from "next/server";
import { getTournamentRace } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/champion?wallet=<address>
 * The race for "The Streakr" — overall standings by the champion metric, plus
 * the crowned champion once the Final has settled.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  try {
    const race = await getTournamentRace(wallet);
    return NextResponse.json({ race });
  } catch (err) {
    console.error("GET /api/champion failed:", err);
    return NextResponse.json({ error: "Failed to load champion race" }, { status: 500 });
  }
}
