import { NextRequest, NextResponse } from "next/server";
import { getNotifications, markNotificationsRead, clearNotifications } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET    /api/me/notifications?wallet=<address> — personal Inbox feed.
 * PATCH  /api/me/notifications                  — mark all read on open.
 * DELETE /api/me/notifications                  — clear all (Inbox "Clear all").
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }
  try {
    const notifications = await getNotifications(wallet);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("GET /api/me/notifications failed:", err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let wallet: string | undefined;
  try {
    wallet = (await req.json())?.walletAddress;
  } catch {
    /* ignore */
  }
  if (!wallet) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  try {
    await markNotificationsRead(wallet);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/me/notifications failed:", err);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let wallet: string | undefined;
  try {
    wallet = (await req.json())?.walletAddress;
  } catch {
    /* ignore */
  }
  if (!wallet) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  try {
    await clearNotifications(wallet);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/me/notifications failed:", err);
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 });
  }
}
