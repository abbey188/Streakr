import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Guard for internal / cron-only endpoints (live sync, full sync, resolve).
 *
 * FAIL CLOSED: if CRON_SECRET is not configured, every request is rejected — a
 * misconfiguration must never silently leave these expensive endpoints public.
 * The secret is compared in constant time to avoid a timing side-channel.
 *
 * Returns a NextResponse to short-circuit on failure, or null to proceed.
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[auth] CRON_SECRET not set — refusing protected request (fail closed)");
    return NextResponse.json({ error: "server not configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
