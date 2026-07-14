import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/db/queries";

// The feed changes live during matches; never cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/feed?limit=60
 * The Hub's Live Feed — recent match moments (goal/card/sub/VAR/shot) across
 * live + just-finished knockout matches, newest-first, each with team + score
 * context. Public: no user-specific data, so no auth required.
 */
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 60;
  try {
    const feed = await getFeed(limit);
    return NextResponse.json({ feed });
  } catch (err) {
    console.error("GET /api/feed failed:", err);
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}
