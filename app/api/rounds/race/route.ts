import { NextRequest, NextResponse } from "next/server";
import { getRoundRace } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/rounds/race?round=<name>&wallet=<address>
 * The Round Champion race for a knockout round (standings + crowned champion).
 */
export async function GET(req: NextRequest) {
  const round = req.nextUrl.searchParams.get("round");
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  if (!round) {
    return NextResponse.json({ error: "round is required" }, { status: 400 });
  }
  try {
    const race = await getRoundRace(round, wallet);
    return NextResponse.json({ race });
  } catch (err) {
    console.error("GET /api/rounds/race failed:", err);
    return NextResponse.json({ error: "Failed to load round race" }, { status: 500 });
  }
}
