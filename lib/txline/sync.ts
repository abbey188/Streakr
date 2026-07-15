import type { Fixture, Team } from "@/src/types";
import type { RawFixture } from "./client";
import type { PersistedMatchEvent } from "./types";
import { sql } from "@/lib/db/client";
import { txlineClient } from "./client";
import { deriveLiveScore, deriveGoals, deriveMatchEvents, deriveMomentum, normalizeFixture, buildRoundMap, type DerivedGoal } from "./normalize";
import { derivePickWindow } from "@/lib/pick-window";
import { resolveFinishedFixtures } from "@/lib/db/resolution";
import { notifyLiveEvents } from "@/lib/db/live-notify";
import { upsertMatchEvents } from "@/lib/db/queries";

/**
 * TxLINE → Neon sync.
 *
 *  • syncFixtures()      — FULL history pull (group stage + knockouts), enriched
 *                          with results. Slow (fans a scores call per fixture);
 *                          run rarely (seed / daily backfill).
 *  • syncLiveFixtures()  — LIGHT pull: only matches near "now" (live / just kicked
 *                          off / about to start / just finished). Fast enough to
 *                          run on a 1–2 min cron for near-real-time updates.
 *
 * Both upsert via the shared helpers and then resolve picks + fire notifications.
 */

const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
// World Cup 2026 kicks off June 14; snapshot returns ~30 days from here.
const WC_START_EPOCH_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);
const BATCH = 12;

// Light-sync window: refresh matches from 4h ago (covers a full match incl.
// ET/penalties) through 45 min ahead — matches KICKOFF_SOON_MS so the "about to
// start" pick reminder actually fires across its full 45-min window (it was
// previously capped at 30 min by this future bound).
const WINDOW_PAST_MS = 4 * 60 * 60 * 1000;
// Widened to 2h so fixtures within their pre-kickoff window are enriched — that's
// when lineups publish, and the feed's roster card needs them before the whistle.
const WINDOW_FUTURE_MS = 2 * 60 * 60 * 1000;
// Within this long before kickoff, also pull the action log so a published
// Lineups block is captured (and the lineup feed moment posted) pre-match.
const PRE_KICKOFF_MS = 2 * 60 * 60 * 1000;

/**
 * Enrich raw fixtures with live score/status (batched parallel scores calls).
 * `roundByGroup` maps FixtureGroupId → real round and MUST be built from the
 * full fixture list (see buildRoundMap), even when only enriching a subset.
 */
async function enrichFixtures(
  raws: RawFixture[],
  roundByGroup: Map<number, string>
): Promise<{ fixtures: Fixture[]; goals: Map<string, DerivedGoal[]>; events: Map<string, PersistedMatchEvent[]> }> {
  const fixtures: Fixture[] = [];
  const goals = new Map<string, DerivedGoal[]>();
  const events = new Map<string, PersistedMatchEvent[]>();
  for (let i = 0; i < raws.length; i += BATCH) {
    const slice = raws.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (rf) => {
        const round = roundByGroup.get(rf.FixtureGroupId);
        const id = String(rf.FixtureId);
        try {
          const entries = await txlineClient.getScoresSnapshot(rf.FixtureId);
          const live = deriveLiveScore(id, entries);
          const fixture = normalizeFixture(rf, live, round);
          const pw = derivePickWindow(id, entries);
          fixture.pickOpen = pw.open;
          fixture.pickCloseReason = (pw.reason ?? null) as Fixture["pickCloseReason"];
          // Goals + feed events come from the ACTION LOG (updates stream), not the
          // snapshot — the snapshot keeps only the latest goal per action-type, so
          // it can't enumerate every goal/card/sub. Only for LIVE fixtures, short
          // timeout so the sync stays fast (the historical log arrives on connect).
          let goals: DerivedGoal[] = [];
          let events: PersistedMatchEvent[] = [];
          // Pull the action log while live, AND in the pre-kickoff window (so the
          // published lineups become the roster card before the whistle).
          const koMs = Number(rf.StartTime);
          const preKickoff = live.status === "upcoming" && koMs > Date.now() && koMs - Date.now() < PRE_KICKOFF_MS;
          if (live.status === "live" || preKickoff) {
            try {
              const updates = await txlineClient.getScoresUpdates(rf.FixtureId, 4000);
              if (updates.length) {
                goals = deriveGoals(updates);
                events = deriveMatchEvents(updates); // emits the lineup moment pre-match
                const momentum = deriveMomentum(updates); // our derived read (live only in practice)
                if (momentum) events.push(momentum);
              }
            } catch { /* leave goals/events empty on a fetch failure */ }
          }
          return { fixture, id, goals, events };
        } catch {
          return { fixture: normalizeFixture(rf, null, round), id, goals: [] as DerivedGoal[], events: [] as PersistedMatchEvent[] };
        }
      })
    );
    for (const r of results) {
      fixtures.push(r.fixture);
      if (r.goals.length) goals.set(r.id, r.goals);
      if (r.events.length) events.set(r.id, r.events);
    }
  }
  return { fixtures, goals, events };
}

/** Flatten the per-fixture events map and persist — best-effort, never throws. */
async function persistMatchEvents(events: Map<string, PersistedMatchEvent[]>): Promise<void> {
  const rows = [...events.entries()].flatMap(([fixtureId, evs]) => evs.map((ev) => ({ fixtureId, ev })));
  if (rows.length === 0) return;
  try {
    await upsertMatchEvents(rows);
  } catch (err) {
    console.error("[sync] match_events upsert failed:", err);
  }
}

/**
 * Upsert the unique teams referenced by a fixture list — ONE batched query via
 * unnest (per-row round-trips are too slow over the high-latency Neon link).
 */
async function upsertTeams(fixtures: Fixture[]): Promise<void> {
  const teams = new Map<string, Team>();
  for (const f of fixtures) { teams.set(f.teamA.id, f.teamA); teams.set(f.teamB.id, f.teamB); }
  const list = [...teams.values()];
  if (list.length === 0) return;
  await sql`
    insert into teams (id, name, flag, code)
    select * from unnest(
      ${list.map((t) => t.id)}::text[], ${list.map((t) => t.name)}::text[],
      ${list.map((t) => t.flag)}::text[], ${list.map((t) => t.code)}::text[]
    )
    on conflict (id) do update
      set name = excluded.name, flag = excluded.flag, code = excluded.code
  `;
}

/**
 * Discover + refresh fixture SCHEDULE for every fixture (teams, round, kickoff)
 * WITHOUT touching score/status/actual_winner on existing rows. Surfaces newly-
 * published fixtures (e.g. R16 appearing as R32 resolves) as "upcoming" within
 * one light-sync cycle, keeps round labels + team names current, and leaves
 * live/finished results intact. One batched query.
 */
async function upsertFixtureSchedule(fixtures: Fixture[]): Promise<void> {
  if (fixtures.length === 0) return;
  await upsertTeams(fixtures);
  await sql`
    insert into fixtures (id, txline_id, round, team_a_id, team_b_id, status, kickoff_time, kickoff_at)
    select id, id, round, a, b, 'upcoming', kt, ka
    from unnest(
      ${fixtures.map((f) => f.id)}::text[], ${fixtures.map((f) => f.round)}::text[],
      ${fixtures.map((f) => f.teamA.id)}::text[], ${fixtures.map((f) => f.teamB.id)}::text[],
      ${fixtures.map((f) => f.kickoffTime)}::text[],
      ${fixtures.map((f) => f.kickoffAt ?? null)}::timestamptz[]
    ) as t(id, round, a, b, kt, ka)
    on conflict (id) do update set
      round = excluded.round,
      team_a_id = excluded.team_a_id, team_b_id = excluded.team_b_id,
      kickoff_time = excluded.kickoff_time, kickoff_at = excluded.kickoff_at,
      updated_at = now()
  `;
}

/** Upsert teams + fixtures (full: includes score/status/winner). One batched query. */
async function upsertFixtures(fixtures: Fixture[]): Promise<void> {
  if (fixtures.length === 0) return;
  await upsertTeams(fixtures);
  await sql`
    insert into fixtures (id, txline_id, round, team_a_id, team_b_id, status,
                          score_a, score_b, minute, period, kickoff_time, kickoff_at, actual_winner,
                          pick_open, pick_close_reason)
    select id, id, round, a, b, status, sa, sb, minute, prd, kt, ka, winner, po, pcr
    from unnest(
      ${fixtures.map((f) => f.id)}::text[], ${fixtures.map((f) => f.round)}::text[],
      ${fixtures.map((f) => f.teamA.id)}::text[], ${fixtures.map((f) => f.teamB.id)}::text[],
      ${fixtures.map((f) => f.status)}::text[],
      ${fixtures.map((f) => f.scoreA ?? null)}::int[], ${fixtures.map((f) => f.scoreB ?? null)}::int[],
      ${fixtures.map((f) => f.minute ?? null)}::int[],
      ${fixtures.map((f) => f.period ?? null)}::text[],
      ${fixtures.map((f) => f.kickoffTime)}::text[],
      ${fixtures.map((f) => f.kickoffAt ?? null)}::timestamptz[],
      ${fixtures.map((f) => f.actualWinner ?? null)}::text[],
      ${fixtures.map((f) => f.pickOpen ?? null)}::boolean[],
      ${fixtures.map((f) => f.pickCloseReason ?? null)}::text[]
    ) as t(id, round, a, b, status, sa, sb, minute, prd, kt, ka, winner, po, pcr)
    on conflict (id) do update set
      round = excluded.round,
      -- 'finished' is TERMINAL: once a match is settled, a later sync can never
      -- regress its status/score/winner (a bad derivation must not un-finish a
      -- match and put it back on the Play page). Schedule fields still refresh.
      status        = case when fixtures.status = 'finished' then 'finished'         else excluded.status        end,
      score_a       = case when fixtures.status = 'finished' then fixtures.score_a    else excluded.score_a       end,
      score_b       = case when fixtures.status = 'finished' then fixtures.score_b    else excluded.score_b       end,
      minute        = case when fixtures.status = 'finished' then fixtures.minute     else excluded.minute        end,
      period        = case when fixtures.status = 'finished' then fixtures.period     else excluded.period        end,
      actual_winner = case when fixtures.status = 'finished' then fixtures.actual_winner else excluded.actual_winner end,
      pick_open         = excluded.pick_open,
      pick_close_reason = excluded.pick_close_reason,
      kickoff_at    = excluded.kickoff_at,
      updated_at    = now()
  `;
}

/** FULL sync — every fixture. Slow; run rarely (seed / daily backfill). */
export async function syncFixtures(): Promise<{ synced: number }> {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, WC_START_EPOCH_DAY);
  const roundByGroup = buildRoundMap(raw);
  const { fixtures: enriched, goals, events } = await enrichFixtures(raw, roundByGroup);

  // Diff live events against the pre-upsert DB state, THEN persist, THEN resolve.
  try {
    await notifyLiveEvents(enriched, goals);
  } catch (err) {
    console.error("[sync] live-notify failed:", err);
  }
  await upsertFixtures(enriched);
  await persistMatchEvents(events); // after fixtures exist (FK)

  // Drop old mock seed fixtures.
  await sql`delete from fixtures where id like 'm%'`;

  try {
    await resolveFinishedFixtures();
  } catch (err) {
    console.error("[sync] resolution failed:", err);
  }

  return { synced: enriched.length };
}

/**
 * LIGHT sync — only matches near "now". Fast enough for a frequent cron, which
 * gives near-real-time scores, live goal/card notifications, kickoff reminders,
 * and pick resolution — and keeps the Neon DB warm (no cold-start splash lag).
 */
export async function syncLiveFixtures(): Promise<{ discovered: number; refreshed: number; live: number }> {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, WC_START_EPOCH_DAY);
  const roundByGroup = buildRoundMap(raw); // built from the FULL list
  const now = Date.now();

  // Safety net: any knockout fixture already past kickoff but NOT finished in the
  // DB — regardless of the light-sync window. Guarantees a match that finished
  // outside the window (long ET/pens, or a cron gap) still gets re-derived and
  // settled, so it can never linger on the Play page. Self-healing: once settled,
  // the terminal-status guard keeps it finished and it drops out of this set.
  // Bounded to the last 3 days to stay cheap.
  const stuckRows = (await sql`
    select id from fixtures
    where status <> 'finished'
      and round <> 'Group Stage'
      and kickoff_at is not null
      and kickoff_at < now()
      and kickoff_at > now() - interval '3 days'
  `) as { id: string }[];
  const stuckIds = new Set(stuckRows.map((r) => r.id));
  if (stuckIds.size > 0) {
    console.warn(
      `[sync] safety-net: re-checking ${stuckIds.size} past-kickoff unfinished fixture(s): ${[...stuckIds].join(", ")}`
    );
  }

  const near = raw.filter((rf) => {
    const t = Number(rf.StartTime); // epoch ms
    const inWindow = Number.isFinite(t) && t >= now - WINDOW_PAST_MS && t <= now + WINDOW_FUTURE_MS;
    return inWindow || stuckIds.has(String(rf.FixtureId));
  });

  const { fixtures: enriched, goals, events } = await enrichFixtures(near, roundByGroup);

  // Compare live events against the true pre-sync DB state first.
  try {
    await notifyLiveEvents(enriched, goals);
  } catch (err) {
    console.error("[sync] live-notify failed:", err);
  }

  // Discover/refresh ALL fixtures' schedule (surfaces new R16/QF/SF/Final as the
  // bracket progresses) — cheap, no scores calls, never clobbers live results.
  const allSchedule = raw.map((rf) =>
    normalizeFixture(rf, null, roundByGroup.get(rf.FixtureGroupId))
  );
  await upsertFixtureSchedule(allSchedule);

  // Then persist live scores/results for near-now matches.
  await upsertFixtures(enriched);
  await persistMatchEvents(events); // after fixtures exist (FK)

  try {
    await resolveFinishedFixtures();
  } catch (err) {
    console.error("[sync] resolution failed:", err);
  }

  const live = enriched.filter((f) => f.status === "live").length;
  return { discovered: allSchedule.length, refreshed: enriched.length, live };
}
