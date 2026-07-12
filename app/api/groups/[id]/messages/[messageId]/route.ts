import { NextRequest, NextResponse } from "next/server";
import { authWallet } from "@/lib/auth/server-auth";
import { isGroupMember, softDeleteGroupMessage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/groups/[id]/messages/[messageId]?wallet=<address>
 * Soft-delete a message. Author-only: softDeleteGroupMessage matches on
 * author_address, so a non-author gets ok:false → 403.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const auth = await authWallet(req, wallet);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isGroupMember(id, auth.wallet))) {
    return NextResponse.json({ error: "not a member of this group" }, { status: 403 });
  }
  const result = await softDeleteGroupMessage(id, messageId, auth.wallet);
  if (!result.ok) {
    return NextResponse.json({ error: "not your message" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
