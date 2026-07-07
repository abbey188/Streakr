import { useState, useEffect } from "react";
import type { Fixture } from "@/src/types";

/**
 * Re-renders on an interval so live minute labels tick up without refetching.
 * (The DB is the source of truth via sync; this just animates the value forward
 * between syncs so a live match never looks frozen.)
 */
export function useNow(intervalMs = 20000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Format a match minute + game phase into a display label: first/second-half
 * stoppage as `45+X` / `90+X`, `HT` and `PENS` breaks, real extra-time minutes,
 * and a `120+` cap so a stuck-live match can't run the clock away. Shared by the
 * card (ticked) and the detail view (live).
 */
export function formatMinute(minute: number | null | undefined, period?: string): string {
  if (minute == null) return period === "PENS" ? "PENS" : "HT";
  if (period === "HT" || period === "ET HT") return "HT";
  if (period === "PENS") return "PENS";
  if (period === "1H" && minute > 45) return `45+${minute - 45}'`;
  if (period === "2H" && minute > 90) return `90+${minute - 90}'`;
  return minute > 120 ? "120+'" : `${minute}'`;
}

/**
 * The live match-minute label, ticked forward client-side from the last synced
 * value (anchored to when the row was last updated). Stays current between syncs
 * and resilient if a sync is briefly delayed. A null minute on a live match means
 * the clock is paused — i.e. halftime.
 */
export function liveMinuteLabel(match: Fixture, nowMs: number): string {
  const anchor = match.updatedAt ? Date.parse(match.updatedAt) : nowMs;
  const ticked =
    match.minute == null ? null : match.minute + Math.max(0, Math.floor((nowMs - anchor) / 60_000));
  return formatMinute(ticked, match.period);
}
