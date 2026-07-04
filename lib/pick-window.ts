import { sql } from "@/lib/db/client";
import { txlineClient, type RawScoreEntry } from "@/lib/txline/client";
import { deriveLiveScore, deriveStats } from "@/lib/txline/normalize";

/**
 * Pick-window rule (Issue 5): a pick is open only while the match is still
 * "even and undecided" — before kickoff, or live in the FIRST HALF (incl. the
 * halftime break) with 0-0 and no red card. It closes on the first CONFIRMED
 * goal, a red card, or the second-half kickoff.
 *
 * Fairness depends on this being checked against FRESH live data at pick time,
 * not the ~1-min-stale DB — otherwise a goal-already-happened informed pick
 * could slip through the lag window.
 */

export type PickCloseReason =
  | "goal"
  | "red"
  | "secondhalf"
  | "finished"
  | "missing"
  | "unknown"
  | null;

/** Decide the window from a fixture's live entries (confirmed-only via the derivers). */
export function derivePickWindow(
  fixtureId: string,
  entries: RawScoreEntry[]
): { open: boolean; reason: PickCloseReason } {
  const live = deriveLiveScore(fixtureId, entries);
  if (live.status === "upcoming") return { open: true, reason: null }; // not kicked off
  if (live.status === "finished") return { open: false, reason: "finished" };
  if ((live.homeScore ?? 0) > 0 || (live.awayScore ?? 0) > 0) return { open: false, reason: "goal" };
  const stats = deriveStats(entries);
  if ((stats.redA ?? 0) + (stats.redB ?? 0) > 0) return { open: false, reason: "red" };
  // 0-0, no red card → open only through the first half + the HT break.
  if (live.period === "1H" || live.period === "HT") return { open: true, reason: null };
  return { open: false, reason: "secondhalf" };
}

/**
 * Authoritative pick-window check for a fixture. Skips the live call when the
 * match is comfortably before kickoff; otherwise fetches a fresh TxLINE snapshot.
 * On a live-check failure, allows only if the DB still says "upcoming" (i.e. we
 * were just before kickoff) — otherwise fails CLOSED to protect fairness.
 */
export async function getPickWindow(
  fixtureId: string
): Promise<{ open: boolean; reason: PickCloseReason }> {
  const rows = (await sql`
    select status, kickoff_at from fixtures where id = ${fixtureId}
  `) as { status: string; kickoff_at: string | null }[];
  if (!rows.length) return { open: false, reason: "missing" };

  const { status, kickoff_at } = rows[0];
  if (status === "finished") return { open: false, reason: "finished" };

  const koMs = kickoff_at ? Date.parse(kickoff_at) : NaN;
  // Clearly before kickoff → open, no live call needed.
  if (Number.isFinite(koMs) && koMs > Date.now() + 60_000) return { open: true, reason: null };

  try {
    const entries = await txlineClient.getScoresSnapshot(fixtureId);
    return derivePickWindow(fixtureId, entries);
  } catch {
    return status === "upcoming" ? { open: true, reason: null } : { open: false, reason: "unknown" };
  }
}

/** User-facing reason for why picks closed (for the API + card copy). */
export function pickCloseCopy(reason: PickCloseReason): string {
  switch (reason) {
    case "goal": return "first goal";
    case "red": return "red card";
    case "secondhalf":
    case "finished": return "";
    default: return "";
  }
}
