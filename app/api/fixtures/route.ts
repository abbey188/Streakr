import { NextRequest, NextResponse } from "next/server";
import { getFixtures } from "@/lib/db/queries";

// Always hit the DB; fixtures change live during matches.
export const dynamic = "force-dynamic";

/**
 * GET /api/fixtures?wallet=<address>
 * Returns Fixture[] (src/types.ts). `wallet` is optional — when present,
 * each fixture is hydrated with that user's userPick.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
  try {
    const fixtures = await getFixtures(wallet);
    return NextResponse.json({ fixtures });
  } catch (err) {
    console.error("GET /api/fixtures failed:", err);
    return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
  }
}
