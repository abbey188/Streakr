import { NextResponse } from "next/server";
import { getActiveAnnouncements } from "@/lib/db/queries";

// Announcements change rarely; a short cache keeps this cheap.
export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * GET /api/announcements
 * Public — the currently-live announcements (tips/updates) for the glance strip.
 * Per-user dismissal is handled client-side (localStorage).
 */
export async function GET() {
  try {
    const announcements = await getActiveAnnouncements();
    return NextResponse.json({ announcements });
  } catch (err) {
    console.error("GET /api/announcements failed:", err);
    // Never break the app over an announcement fetch.
    return NextResponse.json({ announcements: [] });
  }
}
