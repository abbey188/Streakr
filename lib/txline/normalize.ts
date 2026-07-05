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

/**
 * Latest CONFIRMED score state (highest Ts). Skips:
 *  - unconfirmed entries (`Confirmed === false`) — e.g. a goal under VAR review,
 *    so a disallowed goal never becomes the displayed/notified score;
 *  - partial "coverage blip" entries with no real Total, which otherwise flicker
 *    the score to 0-0.
 */
function latestScored(entries: RawScoreEntry[]): RawScoreEntry | null {
  let best: RawScoreEntry | null = null;
  for (const e of entries) {
    if (e.Confirmed === false) continue;
    if (!e.Score?.Participant1?.Total && !e.Score?.Participant2?.Total) continue;
    if (!best || e.Ts > best.Ts) best = e;
  }
  return best;
}

export function deriveLiveScore(fixtureId: string, entries: RawScoreEntry[]): LiveScore {
  // Determine the furthest real PHASE reached AND whether the match is FINALISED.
  //
  // Finalised is driven ONLY by the `game_finalised` action. TxLINE's settlement
  // StatusId 100 is NOT a reliable finalise signal on its own — we saw it ride on
  // a non-terminal `disconnected` event (5 Jul 2026, Brazil v Norway), which would
  // otherwise end a live match and resolve picks mid-game (see docs/txline/FEED_LOG
  // A1 / M1). 100 is not a play phase, so it's excluded from the phase max; the
  // winning METHOD (FT/AET/PENS) is inferred from the deepest real phase code seen.
  let realMax = 1; // furthest genuine game phase (1..19)
  let finalised = false;
  for (const e of entries) {
    const sid = e.StatusId;
    // ONLY the game_finalised action means the match is over. StatusId 100 is a
    // settlement marker that ALSO rides on other actions (e.g. a feed
    // "disconnected" event) — keying finalised off a bare 100 falsely ends a live
    // match. 100 is not a play phase, so it's excluded from the phase max too.
    if (e.Action === "game_finalised") finalised = true;
    if (typeof sid === "number" && sid !== 100 && SOCCER_STATUS[sid] && sid > realMax) realMax = sid;
  }
  let phase = SOCCER_STATUS[realMax] ?? { status: "upcoming" as MatchStatus, period: "NS" };

  const scored = latestScored(entries);
  const p1 = scored?.Score?.Participant1;
  const p2 = scored?.Score?.Participant2;
  const homeScore = g(p1);
  const awayScore = g(p2);

  // Freshest running clock — powers the live minute AND acts as a "still playing"
  // signal below. (latestScored's Clock only moves on a score entry, which freezes
  // the minute in a goalless match; the running clock streams via coverage updates.)
  let seconds = scored?.Clock?.Seconds ?? 0;
  let clockTs = scored?.Ts ?? 0;
  let clockRunning = false;
  for (const e of entries) {
    if (e.Confirmed === false) continue;
    const cs = e.Clock?.Seconds;
    if (typeof cs === "number" && e.Clock?.Running && e.Ts >= clockTs) {
      seconds = cs;
      clockTs = e.Ts;
      clockRunning = true;
    }
  }

  if (finalised && !phase.finished) {
    // A game_finalised landed while the deepest phase code was still mid-play.
    // Settle ONLY when it's safe: the result must be DECISIVE (non-level score or a
    // penalty result — a knockout can't end level), AND the match must not still be
    // actively running. A fresh running clock means the ball is rolling right now,
    // so any finalise signal is stale/glitchy — never end a match that's live.
    const decisive = homeScore !== awayScore || pe(p1) !== pe(p2);
    const stillPlaying = clockRunning && Date.now() - clockTs < 4 * 60_000;
    if (decisive && !stillPlaying) {
      const period = realMax >= 11 ? "PENS" : realMax >= 6 ? "AET" : "FT";
      phase = { status: "finished", period, finished: true, pens: realMax >= 11 };
    }
  }
  // The freshest running-clock entry is itself seconds-to-a-minute old (coverage
  // updates are periodic). While the match is live, advance the clock to real
  // time so the minute reflects NOW — not when the last tick arrived. Without
  // this, the value the sync stores is already behind, and cards (which anchor
  // their client-side tick to the sync time) read persistently late. Capped so a
  // stalled feed can't run the clock away.
  if (phase.status === "live" && clockRunning) {
    seconds += Math.min(3 * 60, Math.max(0, (Date.now() - clockTs) / 1000));
  }

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

// ─── Scorer resolution (goal events → player name via lineups) ────────────────

export interface LastGoal { team: "A" | "B"; scorer: string | null; minute: number }

/** "Ronaldo, Cristiano" → "Ronaldo" (TxLINE names are "Surname, First"). */
function formatPlayerName(raw: string): string {
  return raw.split(",")[0]?.trim() || raw.trim();
}

/**
 * Most recent CONFIRMED goal — team, scorer (resolved from lineups via
 * Data.PlayerId = player.normativeId), and minute. Scorer is opportunistic:
 * some goal events carry no PlayerId, so it can be null (caller falls back to
 * the team name). Never returns a disallowed/unconfirmed goal.
 */
/** normativeId → display surname, built from the Lineups block in the stream. */
function buildPlayerNames(entries: RawScoreEntry[]): Map<number, string> {
  const names = new Map<number, string>();
  const lineups = entries.find((e) => e.Lineups)?.Lineups;
  if (lineups) {
    for (const team of lineups) {
      for (const slot of team.lineups ?? []) {
        const nid = slot.player?.normativeId;
        const nm = slot.player?.preferredName || slot.player?.name;
        if (nid && nm) names.set(nid, formatPlayerName(nm));
      }
    }
  }
  return names;
}

export function deriveLastGoal(entries: RawScoreEntry[]): LastGoal | null {
  const names = buildPlayerNames(entries);
  let best: RawScoreEntry | null = null;
  for (const e of entries) {
    if (e.Confirmed === false) continue;
    const scored =
      e.Action === "goal" ||
      (e.Action === "penalty_outcome" && (e.Data as { Outcome?: string })?.Outcome === "Scored");
    if (!scored) continue;
    if (!best || e.Ts > best.Ts) best = e;
  }
  if (!best) return null;
  const team = best.Participant === 1 ? "A" : best.Participant === 2 ? "B" : null;
  if (!team) return null;
  const pid = (best.Data as { PlayerId?: number })?.PlayerId;
  return {
    team,
    scorer: pid ? names.get(pid) ?? null : null,
    minute: Math.floor((best.Clock?.Seconds ?? 0) / 60),
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
 * Builds the timeline directly from the ACTION stream — the SSE-ready model.
 *
 * Each timeline entry is derived from a single confirmed action (goal, penalty
 * outcome, card, sub, VAR) rather than from score-count deltas. This lets every
 * event carry the player's name (Data.PlayerId → lineup normativeId) and lets
 * VAR sort itself out for free:
 *   • Confirmed === false  → skipped entirely (disallowed / under-review goals
 *     never reach the timeline, so a chalked-off goal doesn't linger).
 *   • penalty_outcome      → a goal only when Outcome==="Scored"; otherwise a
 *     "Penalty missed/saved" beat.
 * The stream retransmits actions (full-game + per-half messages), so events are
 * deduped by a content key (action + team + minute + player). Team comes from
 * the top-level Participant (goals/cards) or Data.Participant (subs). The
 * authoritative scoreline still comes from deriveLiveScore — this is the feed.
 */
export function buildEvents(entries: RawScoreEntry[]): MatchEvent[] {
  const bySeq = new Map<number, RawScoreEntry>();
  for (const e of entries) if (!bySeq.has(e.Seq)) bySeq.set(e.Seq, e);
  const chrono = [...bySeq.values()].sort((a, b) => a.Seq - b.Seq);

  const names = buildPlayerNames(entries);
  const nameOf = (pid: unknown): string | undefined =>
    typeof pid === "number" ? names.get(pid) : undefined;

  // Collect candidates, then collapse retransmits. The stream sends the same
  // action many times; some copies carry Data.PlayerId, some don't. We bucket
  // by (type + team + minute) and, per bucket, keep every DISTINCT named
  // version (so a double-sub in one minute survives) while dropping the
  // player-less retransmits — unless nothing in the bucket was ever named, in
  // which case we keep a single anonymous event so the beat isn't lost.
  interface Cand { bucket: string; who?: string; ev: MatchEvent }
  const cands: Cand[] = [];

  for (const e of chrono) {
    if (e.Confirmed === false) continue; // VAR-pending / disallowed — never show
    const min = minuteOf(e);
    const team = e.Participant === 1 ? "A" : e.Participant === 2 ? "B" : undefined;
    const d = e.Data ?? {};
    const id = `${e.FixtureId}-${e.Seq}`;

    switch (e.Action) {
      case "goal": {
        if (!team) break;
        const pen = d.GoalType === "Penalty";
        const scorer = nameOf(d.PlayerId);
        cands.push({
          bucket: `goal-${team}-${min}`, who: scorer,
          ev: { id, minute: min, team, type: pen ? "penalty" : "goal",
                detail: scorer ? (pen ? `${scorer} (pen)` : scorer) : undefined },
        });
        break;
      }
      case "penalty_outcome": {
        if (!team) break;
        const taker = nameOf(d.PlayerId);
        const scored = d.Outcome === "Scored";
        cands.push({
          bucket: `goal-${team}-${min}`, who: taker,
          ev: scored
            ? { id, minute: min, team, type: "penalty",
                detail: taker ? `${taker} (pen)` : "scored" }
            : { id, minute: min, team, type: "penalty",
                detail: `${taker ? `${taker} — ` : ""}penalty ${String(d.Outcome ?? "missed").toLowerCase()}` },
        });
        break;
      }
      case "yellow_card":
      case "red_card": {
        if (!team) break;
        const player = nameOf(d.PlayerId);
        const type = e.Action === "red_card" ? "red" : "yellow";
        cands.push({
          bucket: `${type}-${team}-${min}`, who: player,
          ev: { id, minute: min, team, type, detail: player },
        });
        break;
      }
      case "substitution": {
        const teamSub = partOf(d) ?? team ?? "A";
        const on = nameOf(d.PlayerInId) ?? nameOf(d.PlayerId);
        const off = nameOf(d.PlayerOutId);
        const detail = on || off ? `${on ?? "?"} on${off ? `, ${off} off` : ""}` : undefined;
        cands.push({
          bucket: `sub-${teamSub}-${min}`, who: on ?? off,
          ev: { id, minute: min, team: teamSub, type: "sub", detail },
        });
        break;
      }
      case "var": {
        cands.push({
          bucket: `var-${min}`, who: undefined,
          ev: { id, minute: min, team: team ?? "A", type: "var",
                detail: (String(d.Type ?? "").toLowerCase() || "review") + " check" },
        });
        break;
      }
    }
  }

  const byBucket = new Map<string, Cand[]>();
  for (const c of cands) {
    const list = byBucket.get(c.bucket);
    if (list) list.push(c); else byBucket.set(c.bucket, [c]);
  }

  const events: MatchEvent[] = [];
  for (const group of byBucket.values()) {
    const named = group.filter((c) => c.who);
    if (named.length) {
      const seenWho = new Set<string>();
      for (const c of named) {
        if (seenWho.has(c.who!)) continue; // same player retransmitted
        seenWho.add(c.who!);
        events.push(c.ev);
      }
    } else {
      events.push(group[0].ev); // never named — keep one anonymous beat
    }
  }

  // Newest first. Stable sort keeps same-minute events grouped.
  return events.sort((a, b) => b.minute - a.minute);
}
