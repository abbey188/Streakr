import type { Fixture, Team } from "@/src/types";
import type { LiveScore, MatchEvent, MatchStats, MatchStatus } from "./types";
import type { RawFixture, RawScoreEntry, RawTotalScore } from "./client";
import { countryInfo } from "./countries";

/**
 * Maps TxLINE's raw payloads → the app's normalized types.
 *
 * Team mapping: teamA = Participant1, teamB = Participant2 (matches the Score
 * object's Participant1/Participant2, and our "A"/"B" pick model). "advanced"
 * uses Total.Goals with a penalties (PE) tiebreak — i.e. who goes through.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

function team(name: string, id: number): Team {
  const { flag, code } = countryInfo(name);
  return { id: String(id), name, flag, code };
}

/** Fallback only: infer round from kickoff date if FixtureGroupId is missing. */
function roundForDate(startMs: number): string {
  const d = new Date(startMs);
  const m = d.getUTCMonth() + 1; // 6 = June, 7 = July
  const day = d.getUTCDate();
  if (m === 6 && day < 28) return "Group Stage";
  if ((m === 6 && day >= 28) || (m === 7 && day <= 5)) return "Round of 32";
  if (m === 7 && day <= 11) return "Round of 16";
  if (m === 7 && day <= 15) return "Quarterfinals";
  if (m === 7 && day <= 18) return "Semifinals";
  return "Final";
}

const KNOCKOUT_ORDER = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Final"];

/**
 * Derives each fixture's real round from TxLINE's FixtureGroupId clustering
 * (TxLINE gives no round name). The group stage is one big cluster (round-robin,
 * far more matches); each knockout round is its own cluster. So: the largest
 * cluster = Group Stage, and the rest — ordered by earliest kickoff — are
 * R32 → R16 → QF → SF → Final. Tournament-agnostic (no hardcoded IDs), and
 * robust to partially-scheduled later rounds.
 */
export function buildRoundMap(raw: RawFixture[]): Map<number, string> {
  const byGroup = new Map<number, RawFixture[]>();
  for (const f of raw) {
    const list = byGroup.get(f.FixtureGroupId);
    if (list) list.push(f);
    else byGroup.set(f.FixtureGroupId, [f]);
  }

  // Group stage = the cluster with the most matches (knockout rounds max at 16).
  let groupStageId: number | null = null;
  let maxCount = -1;
  for (const [g, list] of byGroup) {
    if (list.length > maxCount) { maxCount = list.length; groupStageId = g; }
  }

  const knockouts = [...byGroup.entries()]
    .filter(([g]) => g !== groupStageId)
    .map(([g, list]) => ({ g, start: Math.min(...list.map((f) => f.StartTime)) }))
    .sort((a, b) => a.start - b.start);

  const map = new Map<number, string>();
  if (groupStageId !== null) map.set(groupStageId, "Group Stage");
  knockouts.forEach((k, i) => map.set(k.g, KNOCKOUT_ORDER[i] ?? "Final"));
  return map;
}

export function normalizeFixture(
  raw: RawFixture,
  live?: LiveScore | null,
  roundOverride?: string
): Fixture {
  const teamA = team(raw.Participant1, raw.Participant1Id);
  const teamB = team(raw.Participant2, raw.Participant2Id);
  const kickoff = new Date(raw.StartTime);
  const kickoffTime = kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const round = roundOverride ?? roundForDate(raw.StartTime);
  // Fixture.status has no "halftime" — fold it into "live".
  let fixtureStatus: Fixture["status"] =
    live?.status === "halftime" ? "live" : live?.status ?? "upcoming";

  // A knockout match can never truly end level: if the feed reports "finished"
  // but there's no decisive winner (draw with no penalty result yet — i.e. it's
  // between full-time and ET/penalties, or the feed is lagging), it is NOT final.
  // Keep it "live" so it stays out of Completed and its picks don't resolve until
  // a real winner lands. (Group stage draws are legitimate and never reach here —
  // group fixtures are filtered out of the pick/Hub screens.)
  if (fixtureStatus === "finished" && round !== "Group Stage" && !live?.advanced) {
    fixtureStatus = "live";
  }

  return {
    id: String(raw.FixtureId),
    round,
    teamA,
    teamB,
    status: fixtureStatus,
    scoreA: live?.homeScore,
    scoreB: live?.awayScore,
    minute: fixtureStatus === "live" ? live?.minute : undefined,
    kickoffTime,
    kickoffAt: kickoff.toISOString(),
    actualWinner: live?.advanced,
  };
}

// ─── Score state (from the scores snapshot — latest state per action) ────────

const g = (t?: RawTotalScore) => t?.Total?.Goals ?? 0;
const pe = (t?: RawTotalScore) => t?.PE?.Goals ?? 0;

/**
 * Soccer game-phase codes (TxODDS soccer feed spec). Maps StatusId → our status
 * + a display period, plus flags for penalties/finished so the Hub can render
 * exactly like SofaScore (penalties only surface once the shootout phase begins).
 */
const SOCCER_STATUS: Record<number, { status: MatchStatus; period: string; pens?: boolean; finished?: boolean }> = {
  1: { status: "upcoming", period: "NS" },
  2: { status: "live", period: "1H" },
  3: { status: "halftime", period: "HT" },
  4: { status: "live", period: "2H" },
  5: { status: "finished", period: "FT", finished: true },
  6: { status: "live", period: "ET" },      // waiting for extra time
  7: { status: "live", period: "ET1" },
  8: { status: "halftime", period: "ET HT" },
  9: { status: "live", period: "ET2" },
  10: { status: "finished", period: "AET", finished: true },
  11: { status: "live", period: "PENS", pens: true },   // waiting for shootout
  12: { status: "live", period: "PENS", pens: true },    // shootout in progress
  13: { status: "finished", period: "PENS", pens: true, finished: true },
  14: { status: "live", period: "INT" },     // interrupted
  15: { status: "finished", period: "ABD", finished: true },
  16: { status: "finished", period: "CANC", finished: true },
  19: { status: "upcoming", period: "PP" },  // postponed
};

/** Latest entry that carries a Score (highest Ts). */
function latestScored(entries: RawScoreEntry[]): RawScoreEntry | null {
  let best: RawScoreEntry | null = null;
  for (const e of entries) if (e.Score && (!best || e.Ts > best.Ts)) best = e;
  return best;
}

export function deriveLiveScore(fixtureId: string, entries: RawScoreEntry[]): LiveScore {
  // Phases progress NS(1)→H1(2)→…→F(5)→ET→PENS. Take the furthest phase reached
  // (max StatusId) — newest-by-timestamp can be a stale coverage_update at NS.
  const statusId = entries.reduce(
    (m, e) => (typeof e.StatusId === "number" && e.StatusId > m ? e.StatusId : m),
    1
  );
  const phase = SOCCER_STATUS[statusId] ?? { status: "upcoming" as MatchStatus, period: "NS" };

  const scored = latestScored(entries);
  const p1 = scored?.Score?.Participant1;
  const p2 = scored?.Score?.Participant2;
  const homeScore = g(p1);
  const awayScore = g(p2);
  const seconds = scored?.Clock?.Seconds ?? 0;

  // Only surface penalties once the shootout phase is reached (SofaScore-style).
  const showPens = Boolean(phase.pens) || p1?.PE?.Goals !== undefined || p2?.PE?.Goals !== undefined;

  let advanced: "A" | "B" | undefined;
  if (phase.finished) {
    if (homeScore !== awayScore) advanced = homeScore > awayScore ? "A" : "B";
    else {
      const a = pe(p1), b = pe(p2);
      if (a !== b) advanced = a > b ? "A" : "B";
    }
  }

  return {
    fixtureId,
    status: phase.status,
    minute: phase.status === "live" ? Math.floor(seconds / 60) : undefined,
    period: phase.period,
    homeScore,
    awayScore,
    homePenalties: showPens ? p1?.PE?.Goals ?? 0 : undefined,
    awayPenalties: showPens ? p2?.PE?.Goals ?? 0 : undefined,
    advanced,
  };
}

// ─── Stats (corners + cards from the Score object — reliable) ─────────────────

export function deriveStats(entries: RawScoreEntry[]): MatchStats {
  const latest = latestScored(entries);
  const p1 = latest?.Score?.Participant1?.Total;
  const p2 = latest?.Score?.Participant2?.Total;
  if (!p1 && !p2) return {};
  return {
    cornersA: p1?.Corners,
    cornersB: p2?.Corners,
    yellowA: p1?.YellowCards,
    yellowB: p2?.YellowCards,
    redA: p1?.RedCards,
    redB: p2?.RedCards,
  };
}

// ─── Event timeline (from chronological update entries) ──────────────────────

const partOf = (data?: Record<string, unknown>): "A" | "B" | undefined =>
  data?.Participant === 1 ? "A" : data?.Participant === 2 ? "B" : undefined;

const minuteOf = (e: RawScoreEntry): number => {
  const s = e.Clock?.Seconds;
  if (typeof s === "number") return Math.floor(s / 60);
  const m = e.Data?.Minutes;
  return typeof m === "number" ? m : 0;
};

/**
 * Builds the timeline from the chronological stream. The stream retransmits each
 * event several times (full-game + per-half stat messages) and card/sub team
 * isn't in the action itself, so:
 *   • goals/cards → emitted when the cumulative Score COUNT increments (exact
 *     count + correct team, naturally deduped)
 *   • subs/VAR → from action entries (team via Data.Participant), deduped
 * Corners are left to the stats panel (too frequent for a timeline).
 */
export function buildEvents(entries: RawScoreEntry[]): MatchEvent[] {
  // Dedupe retransmits by Seq, process in order.
  const bySeq = new Map<number, RawScoreEntry>();
  for (const e of entries) if (!bySeq.has(e.Seq)) bySeq.set(e.Seq, e);
  const chrono = [...bySeq.values()].sort((a, b) => a.Seq - b.Seq);

  const events: MatchEvent[] = [];
  let g1 = 0, g2 = 0, y1 = 0, y2 = 0, r1 = 0, r2 = 0;
  const actionSeen = new Set<string>();

  for (const e of chrono) {
    const t = e.Score?.Participant1?.Total;
    const u = e.Score?.Participant2?.Total;
    const ng1 = t?.Goals ?? g1, ng2 = u?.Goals ?? g2;
    const ny1 = t?.YellowCards ?? y1, ny2 = u?.YellowCards ?? y2;
    const nr1 = t?.RedCards ?? r1, nr2 = u?.RedCards ?? r2;
    const min = minuteOf(e);
    const goalDetail =
      e.Action === "goal" ? (String(e.Data?.GoalType ?? "") || undefined) : undefined;
    const goalType = e.Data?.GoalType === "Penalty" ? "penalty" : "goal";

    // Goals — one event per increment, attributed to the side whose count grew.
    for (let k = g1; k < ng1; k++)
      events.push({ id: `${e.FixtureId}-gA-${k}`, minute: min, team: "A", type: goalType, detail: goalDetail });
    for (let k = g2; k < ng2; k++)
      events.push({ id: `${e.FixtureId}-gB-${k}`, minute: min, team: "B", type: goalType, detail: goalDetail });
    for (let k = y1; k < ny1; k++)
      events.push({ id: `${e.FixtureId}-yA-${k}`, minute: min, team: "A", type: "yellow" });
    for (let k = y2; k < ny2; k++)
      events.push({ id: `${e.FixtureId}-yB-${k}`, minute: min, team: "B", type: "yellow" });
    for (let k = r1; k < nr1; k++)
      events.push({ id: `${e.FixtureId}-rA-${k}`, minute: min, team: "A", type: "red" });
    for (let k = r2; k < nr2; k++)
      events.push({ id: `${e.FixtureId}-rB-${k}`, minute: min, team: "B", type: "red" });

    // Subs — collapse retransmits to one per team per minute (the stream
    // duplicates them and PlayerOutId isn't reliably present).
    if (e.Action === "substitution") {
      const teamSub = partOf(e.Data) ?? "A";
      const key = `sub-${min}-${teamSub}`;
      if (!actionSeen.has(key)) {
        actionSeen.add(key);
        events.push({ id: `${e.FixtureId}-${e.Seq}`, minute: min, team: teamSub, type: "sub" });
      }
    } else if (e.Action === "var") {
      // Collapse VAR check + outcome at the same minute into one entry.
      const key = `var-${min}`;
      if (!actionSeen.has(key)) {
        actionSeen.add(key);
        events.push({ id: `${e.FixtureId}-${e.Seq}`, minute: min, team: partOf(e.Data) ?? "A", type: "var", detail: String(e.Data?.Type ?? "") || undefined });
      }
    }

    g1 = ng1; g2 = ng2; y1 = ny1; y2 = ny2; r1 = nr1; r2 = nr2;
  }

  return events.reverse(); // newest first
}
