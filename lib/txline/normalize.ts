import type { Fixture, Team } from "@/src/types";
import type { LiveScore, MatchEvent, MatchStats, MatchStatus, PersistedMatchEvent } from "./types";
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

/** Knockout round by match count. A round halves the field, so the size is the
 *  round: 16 matches = Round of 32, 8 = Round of 16, and so on. */
const ROUND_BY_SIZE: Record<number, string> = {
  16: "Round of 32", 8: "Round of 16", 4: "Quarterfinals", 2: "Semifinals",
};

/**
 * Derives each fixture's real round from TxLINE's FixtureGroupId clustering
 * (TxLINE gives no round name). The group stage is one big cluster (round-robin,
 * far more matches); each knockout round is its own cluster.
 *
 * Rounds are identified by CLUSTER SIZE, not by position. Position looks right
 * until the third-place play-off shows up: it is its own single-match cluster
 * that kicks off BEFORE the Final, so an index-based map slides everything down
 * one and labels both it and the Final "Final". Size is unambiguous, and it
 * survives formats that skip rounds — which a domestic cup will.
 *
 * That leaves the two single-match clusters. They can only be the third-place
 * play-off and the Final, and the Final is always last.
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
    .map(([g, list]) => ({ g, size: list.length, start: Math.min(...list.map((f) => f.StartTime)) }))
    .sort((a, b) => a.start - b.start);

  const map = new Map<number, string>();
  if (groupStageId !== null) map.set(groupStageId, "Group Stage");

  const singles = knockouts.filter((k) => k.size === 1); // 3rd place + Final
  for (const k of knockouts) {
    if (k.size === 1) {
      // Last single-match cluster is the Final; an earlier one is the play-off.
      map.set(k.g, k === singles[singles.length - 1] ? "Final" : "Third Place");
    } else {
      map.set(k.g, ROUND_BY_SIZE[k.size] ?? "Knockout");
    }
  }
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
    period: fixtureStatus === "live" ? live?.period : undefined,
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

export interface DerivedGoal { side: "A" | "B"; scorer: string | null; minute: number; seq: number; ts: number; key: string }

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

/**
 * ALL confirmed goals in the snapshot, each with a STABLE identity (the action's
 * Seq — the feed retransmits an action with the same Seq). Notifications key off
 * this instead of score-count diffs, which fixes two real bugs: rapid doubles
 * (two goals in one sync interval) each surface as distinct actions, and a score
 * flicker (regress→re-rise) can't produce a duplicate because the Seq is stable.
 * Disallowed/unconfirmed goals (Confirmed === false) are skipped entirely.
 */
export function deriveGoals(entries: RawScoreEntry[]): DerivedGoal[] {
  const names = buildPlayerNames(entries);
  const byGoal = new Map<string, DerivedGoal>();
  for (const e of entries) {
    if (e.Confirmed === false) continue;
    const scored =
      e.Action === "goal" ||
      (e.Action === "penalty_outcome" && (e.Data as { Outcome?: string })?.Outcome === "Scored");
    if (!scored) continue;
    const side = e.Participant === 1 ? "A" : e.Participant === 2 ? "B" : null;
    if (!side) continue;
    const minute = Math.floor((e.Clock?.Seconds ?? 0) / 60);
    // Stable per-goal identity = the scoring side's cumulative goal count AFTER
    // this goal. The feed emits each goal as several entries (unnamed, then named,
    // same score) — this collapses them into one, and still distinguishes
    // different goals (incl. same-minute doubles) since each has a distinct
    // running total. Falls back to (side, minute) if the score field is absent.
    const sideGoals = side === "A"
      ? e.Score?.Participant1?.Total?.Goals
      : e.Score?.Participant2?.Total?.Goals;
    const key = sideGoals != null ? `${side}:${sideGoals}` : `${side}:m${minute}`;
    const pid = (e.Data as { PlayerId?: number })?.PlayerId;
    const scorer = pid ? names.get(pid) ?? null : null;
    const existing = byGoal.get(key);
    if (!existing) {
      byGoal.set(key, { side, scorer, minute, seq: e.Seq, ts: e.Ts, key });
    } else {
      if (!existing.scorer && scorer) existing.scorer = scorer; // upgrade to the named version
      if (e.Seq < existing.seq) existing.seq = e.Seq;
      if (e.Ts < existing.ts) existing.ts = e.Ts;
    }
  }
  return [...byGoal.values()].sort((a, b) => a.seq - b.seq);
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

const POSSESSION_ACTIONS = new Set([
  "possession", "attack_possession", "danger_possession",
  "high_danger_possession", "safe_possession",
]);

/**
 * Advanced stats from the ACTION LOG (updates stream) — these aren't in the
 * on-chain Stats map. Possession = share of possession events per team; shots =
 * confirmed `shot` actions (on target = Outcome "OnTarget"); offsides =
 * `free_kick` with FreeKickType "Offside" (TxLINE feed spec, 6 Jul 2026).
 */
export function deriveAdvancedStats(updates: RawScoreEntry[]): Partial<MatchStats> {
  let posA = 0, posB = 0, shotsA = 0, shotsB = 0, sotA = 0, sotB = 0, offA = 0, offB = 0;
  for (const e of updates) {
    const p = e.Participant;
    if (p !== 1 && p !== 2) continue;
    if (POSSESSION_ACTIONS.has(e.Action)) {
      if (p === 1) posA++; else posB++;
      continue;
    }
    if (e.Confirmed === false) continue;
    if (e.Action === "shot") {
      const outcome = (e.Data as { Outcome?: string })?.Outcome;
      if (!outcome) continue; // unclassified attempt — not a counted shot
      if (p === 1) { shotsA++; if (outcome === "OnTarget") sotA++; }
      else { shotsB++; if (outcome === "OnTarget") sotB++; }
    } else if (e.Action === "free_kick" && (e.Data as { FreeKickType?: string })?.FreeKickType === "Offside") {
      if (p === 1) offA++; else offB++;
    }
  }
  const posTotal = posA + posB;
  return {
    possessionA: posTotal ? Math.round((posA / posTotal) * 100) : undefined,
    possessionB: posTotal ? Math.round((posB / posTotal) * 100) : undefined,
    shotsA, shotsB, shotsOnTargetA: sotA, shotsOnTargetB: sotB,
    offsidesA: offA, offsidesB: offB,
  };
}

// ─── Persisted feed events (match_events) ────────────────────────────────────

/** Drop undefined values so a later (named) merge never overwrites a real value with a blank. */
function pruneU(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

/** Football stoppage-time label: 47' in the first half → "45+2". Undefined when
 *  the minute is within regulation (the feed then just shows `${minute}'`). */
function stoppageMinLabel(min: number, phase: string): string | undefined {
  if (phase === "1H" && min > 45) return `45+${min - 45}`;
  if (phase === "2H" && min > 90) return `90+${min - 90}`;
  if ((phase === "ET1" || phase === "ET") && min > 105) return `105+${min - 105}`;
  if (phase === "ET2" && min > 120) return `120+${min - 120}`;
  return undefined;
}

/** StatusId → the one-off "match state" beat it should post to the feed. */
const STATUS_BEAT: Record<number, string> = {
  2: "kickoff", 3: "ht", 6: "et", 7: "et", 11: "pens", 12: "pens",
};

/**
 * Derives the Live Feed's persistable moments from the action log — the same
 * confirmed beats buildEvents renders (goal · penalty · yellow · red · sub · var
 * · shot), each with a STABLE event_key so the sync can upsert idempotently:
 *   • goals key on the running score (`goal:A:2`) — identical for the unnamed and
 *     the later named copy, so the scorer just fills into the same row (never a
 *     duplicate). Matches deriveGoals' proven identity.
 *   • cards/subs/shots/var key on (type, side, minute[, id/outcome]).
 * The log is a FULL retransmitting stream, so re-deriving each poll and upserting
 * is self-healing. Unconfirmed (VAR-pending / disallowed) entries are skipped.
 */
export function deriveMatchEvents(entries: RawScoreEntry[]): PersistedMatchEvent[] {
  const names = buildPlayerNames(entries);
  const nameOf = (pid: unknown): string | undefined =>
    typeof pid === "number" ? names.get(pid) : undefined;

  const bySeq = new Map<number, RawScoreEntry>();
  for (const e of entries) if (!bySeq.has(e.Seq)) bySeq.set(e.Seq, e);
  const chrono = [...bySeq.values()].sort((a, b) => a.Seq - b.Seq);

  let phase = "NS"; // running match phase (drives stoppage labels + state beats)
  let maxSid = 0;   // furthest phase reached — advances only, so glitches can't regress it
  const byKey = new Map<string, PersistedMatchEvent>();
  const put = (key: string, ev: Omit<PersistedMatchEvent, "key">) => {
    const p = pruneU(ev.payload);
    const label = stoppageMinLabel(ev.minute, phase);
    // "45+2" for a moment during stoppage — but never for a state marker itself.
    if (label && ev.type !== "status" && ev.type !== "stoppage") p.min = label;
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, { key, ...ev, payload: p }); return; }
    cur.seq = Math.min(cur.seq, ev.seq);         // earliest transmission orders it
    if (!cur.minute && ev.minute) cur.minute = ev.minute;
    cur.payload = { ...cur.payload, ...p }; // named beats unnamed
    if (ev.confirmed) cur.confirmed = true;
  };

  for (const e of chrono) {
    if (e.Confirmed === false) continue; // VAR-pending / disallowed — never persist
    const side = e.Participant === 1 ? "A" : e.Participant === 2 ? "B" : undefined;
    const min = minuteOf(e);
    const d = e.Data ?? {};
    const runningGoals = (s: "A" | "B") =>
      s === "A" ? e.Score?.Participant1?.Total?.Goals : e.Score?.Participant2?.Total?.Goals;

    // ── Match-state beats + phase tracking (kickoff / HT / FT / ET / pens) ──
    // Advance the phase MONOTONICALLY (StatusId 1..13 are ordered by progression),
    // so a glitchy status riding on a coverage/disconnect entry can't regress the
    // phase or re-fire a beat. Beat fires once, when a phase is first reached.
    const sid = e.StatusId;
    if (typeof sid === "number" && sid >= 1 && sid <= 13 && sid > maxSid) {
      maxSid = sid;
      phase = SOCCER_STATUS[sid].period;
      const kind = STATUS_BEAT[sid];
      if (kind) put(`status:${kind}`, { seq: e.Seq, type: "status", minute: min, confirmed: true, payload: { kind } });
    }
    if (e.Action === "game_finalised") {
      put("status:ft", { seq: e.Seq, type: "status", minute: min, confirmed: true, payload: { kind: "ft" } });
    }
    if (e.Action === "additional_time" && typeof d.Minutes === "number" && (d.Minutes as number) > 0) {
      put(`stoppage:${phase}`, { seq: e.Seq, type: "stoppage", minute: min, confirmed: true, payload: { minutes: d.Minutes, phase } });
    }

    switch (e.Action) {
      case "goal": {
        if (!side) break;
        const pen = d.GoalType === "Penalty";
        const rg = runningGoals(side);
        const key = rg != null ? `goal:${side}:${rg}` : `goal:${side}:m${min}`;
        put(key, { seq: e.Seq, type: pen ? "penalty" : "goal", minute: min, confirmed: true,
          payload: { side, scorer: nameOf(d.PlayerId), penalty: pen || undefined } });
        break;
      }
      case "penalty_outcome": {
        if (!side) break;
        const outcome = String(d.Outcome ?? "");
        const taker = nameOf(d.PlayerId);
        if (outcome === "Scored") {
          const rg = runningGoals(side);
          const key = rg != null ? `goal:${side}:${rg}` : `goal:${side}:pen:${min}`;
          put(key, { seq: e.Seq, type: "penalty", minute: min, confirmed: true,
            payload: { side, scorer: taker, penalty: true } });
        } else {
          put(`penmiss:${side}:${min}`, { seq: e.Seq, type: "penalty_missed", minute: min, confirmed: true,
            payload: { side, player: taker, outcome: outcome.toLowerCase() || "missed" } });
        }
        break;
      }
      case "yellow_card":
      case "red_card": {
        if (!side) break;
        const type = e.Action === "red_card" ? "red" : "yellow";
        put(`${type}:${side}:${min}`, { seq: e.Seq, type, minute: min, confirmed: true,
          payload: { side, player: nameOf(d.PlayerId), cardType: d.Type } });
        break;
      }
      case "substitution": {
        const subSide = partOf(d) ?? side;
        const key = `sub:${subSide ?? "?"}:${d.PlayerInId ?? d.PlayerOutId ?? min}`;
        put(key, { seq: e.Seq, type: "sub", minute: min, confirmed: true,
          payload: { side: subSide, on: nameOf(d.PlayerInId), off: nameOf(d.PlayerOutId) } });
        break;
      }
      case "var_end": {
        // The resolution (Stands / Overturned) is the meaningful beat, not the check-start.
        const outcome = String(d.Outcome ?? "").toLowerCase();
        put(`var:${min}:${outcome || "review"}`, { seq: e.Seq, type: "var", minute: min, confirmed: true,
          payload: { side, outcome: outcome || "review" } });
        break;
      }
      case "shot": {
        if (!side) break;
        const outcome = String(d.Outcome ?? "");
        if (outcome !== "OnTarget" && outcome !== "Woodwork") break; // only the notable ones
        put(`shot:${side}:${min}:${outcome}`, { seq: e.Seq, type: "shot", minute: min, confirmed: true,
          payload: { side, player: nameOf(d.PlayerId), outcome } });
        break;
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.seq - b.seq);
}

// ─── Momentum (our derived read of the possession stream) ────────────────────

const MOMENTUM_WEIGHTS: Record<string, number> = {
  high_danger_possession: 3, danger_possession: 2.5, attack_possession: 2,
  possession: 1, safe_possession: 0.5,
};

/**
 * Derives a MOMENTUM moment — our own read, not a raw TxLINE field. It's a
 * blended index over the last ~10 min of match clock, not raw possession: the
 * five possession tiers weighted by danger, PLUS shots (a shot on target is a
 * strong momentum signal) and corners (territory). When one side holds ≥60% of
 * that weighted momentum it emits ONE event, bucketed to a 10-min block so it
 * can't spam, and never before the 20th minute (too early to call a swing).
 * Re-derived + upserted each poll; returns null when play is even.
 */
export function deriveMomentum(updates: RawScoreEntry[]): PersistedMatchEvent | null {
  const pts: { side: "A" | "B"; w: number; sec: number; seq: number }[] = [];
  for (const e of updates) {
    const side = e.Participant === 1 ? "A" : e.Participant === 2 ? "B" : null;
    const sec = e.Clock?.Seconds;
    if (!side || typeof sec !== "number") continue;
    let w = MOMENTUM_WEIGHTS[e.Action] ?? 0;
    if (!w && e.Action === "shot" && e.Confirmed !== false) {
      const o = (e.Data as { Outcome?: string })?.Outcome;
      w = o === "OnTarget" || o === "Woodwork" ? 6 : o ? 3 : 0; // shots weigh heavily
    }
    if (!w && e.Action === "corner") w = 2; // territory
    if (!w) continue;
    pts.push({ side, w, sec, seq: e.Seq });
  }
  if (pts.length < 20) return null;
  const latest = Math.max(...pts.map((p) => p.sec));
  const minute = Math.floor(latest / 60);
  if (minute < 20) return null; // too early to call momentum
  const win = pts.filter((p) => p.sec >= latest - 600); // last 10 min of clock
  if (win.length < 15) return null; // not enough recent signal
  let a = 0, b = 0;
  for (const p of win) { if (p.side === "A") a += p.w; else b += p.w; }
  const total = a + b;
  if (!total) return null;
  const pa = Math.round((a / total) * 100);
  const pb = 100 - pa;
  const lead = pa >= pb ? "A" : "B";
  if (Math.max(pa, pb) < 60) return null; // balanced — no swing to report
  return {
    key: `momentum:${lead}:${Math.floor(minute / 10)}`, // one per team per 10-min block
    seq: Math.max(...win.map((p) => p.seq)),
    type: "momentum",
    minute,
    confirmed: true,
    payload: { side: lead, possA: pa, possB: pb },
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
        const t = String(d.Type ?? "").toLowerCase();
        cands.push({
          bucket: `varstart-${min}`, who: undefined,
          ev: { id, minute: min, team: team ?? "A", type: "var",
                detail: t ? `checking ${t}` : "under review" },
        });
        break;
      }
      case "var_end": {
        // The resolution — Stands / Overturned (the confirmed, meaningful beat).
        const outcome = String(d.Outcome ?? "").toLowerCase();
        cands.push({
          bucket: `varend-${min}`, who: undefined,
          ev: { id, minute: min, team: team ?? "A", type: "var",
                detail: outcome === "overturned" ? "decision overturned"
                  : outcome === "stands" ? "decision stands" : "review complete" },
        });
        break;
      }
      case "shot": {
        // Only the notable shots — a full log of every off-target / blocked
        // attempt would drown the timeline. On target + woodwork are the drama.
        if (!team) break;
        const outcome = String(d.Outcome ?? "");
        if (outcome !== "OnTarget" && outcome !== "Woodwork") break;
        const player = nameOf(d.PlayerId);
        cands.push({
          bucket: `shot-${team}-${min}`, who: player,
          ev: { id, minute: min, team, type: "shot",
                detail: outcome === "Woodwork"
                  ? (player ? `${player} — off the woodwork` : "off the woodwork")
                  : (player ? `${player} — shot on target` : "shot on target") },
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
