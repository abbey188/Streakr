import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/db/queries";
import { verifiedUserId, getAuthedWallet, deletePrivyUser } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/me/account
 * Permanently delete the caller's account and all their data (right to erasure).
 * Identity comes from the VERIFIED token, so a user can only delete their OWN
 * account. Wipes the DB user (cascades picks / notifications / group memberships
 * / champion records) and the Privy user.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await verifiedUserId(req);
    const wallet = await getAuthedWallet(req);
    if (!userId || !wallet) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    await deleteUserAccount(wallet); // DB (FK cascade wipes their data)
    await deletePrivyUser(userId); // Privy identity + embedded wallet
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/me/account failed:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
