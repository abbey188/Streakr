import { NextRequest, NextResponse } from "next/server";
import { getAuthedWallet } from "@/lib/auth/server-auth";
import { deletePushSubscription } from "@/lib/push/server";

export const dynamic = "force-dynamic";

/** POST /api/push/unsubscribe — remove a browser push subscription by endpoint. */
export async function POST(req: NextRequest) {
  try {
    const wallet = await getAuthedWallet(req);
    if (!wallet) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const endpoint = body?.endpoint;
    if (!endpoint) return NextResponse.json({ error: "missing endpoint" }, { status: 400 });

    await deletePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push/unsubscribe failed:", err);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
