import { NextResponse } from "next/server";
import { getBadges } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET /api/badges → Badge[] (the achievement catalog). */
export async function GET() {
  try {
    const badges = await getBadges();
    return NextResponse.json({ badges });
  } catch (err) {
    console.error("GET /api/badges failed:", err);
    return NextResponse.json({ error: "Failed to load badges" }, { status: 500 });
  }
}
