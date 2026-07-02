import { NextRequest, NextResponse } from "next/server";
import { getGroupActivity } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id]/activity → ActivityItem[]
 * The group-scoped social feed (milestones, breaks, wins, badges).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const activity = await getGroupActivity(id);
    return NextResponse.json({ activity });
  } catch (err) {
    console.error("GET /api/groups/[id]/activity failed:", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
