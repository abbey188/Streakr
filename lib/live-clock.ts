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
 * The live match-minute label, ticked forward client-side from the last synced
 * value (anchored to when the row was last updated). Stays current between syncs
 * and resilient if a sync is briefly delayed. A null minute on a live match means
 * the clock is paused — i.e. halftime.
 */
export function liveMinuteLabel(match: Fixture, nowMs: number): string {
  if (match.minute == null) return "HT";
  const anchor = match.updatedAt ? Date.parse(match.updatedAt) : nowMs;
  const ticked = match.minute + Math.max(0, Math.floor((nowMs - anchor) / 60_000));
  return ticked >= 90 ? "90+'" : `${ticked}'`;
}
