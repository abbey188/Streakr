import { NextRequest, NextResponse } from "next/server";
import { getAuthedWallet } from "@/lib/auth/server-auth";
import { savePushSubscription } from "@/lib/push/server";

export const dynamic = "force-dynamic";

/** POST /api/push/subscribe — store the caller's browser push subscription. */
export async function POST(req: NextRequest) {
  try {
    const wallet = await getAuthedWallet(req);
    if (!wallet) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    await savePushSubscription(wallet, sub);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push/subscribe failed:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
