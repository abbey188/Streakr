import type { Fixture } from "@/src/types";
import type { TxlineProvider, MatchDetail } from "./types";
import { txlineClient, type RawFixture } from "./client";
import { normalizeFixture, deriveLiveScore, deriveStats, buildEvents } from "./normalize";

/**
 * Real TxLINE provider — pulls live World Cup data server-side and normalizes it.
 * Short in-memory caches keep the fixtures list snappy without hammering the API.
 */

const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);

// Tiny caches (per server instance). Fixtures list is the expensive one
// (fans out to a scores call per fixture), so cache it briefly.
let fixturesCache: { at: number; data: Fixture[] } | null = null;
let rawFixturesCache: { at: number; data: RawFixture[] } | null = null;
const FIXTURES_TTL = 30_000;

async function getRawFixtures(): Promise<RawFixture[]> {
  if (rawFixturesCache && Date.now() - rawFixturesCache.at < FIXTURES_TTL) {
    return rawFixturesCache.data;
  }
  const data = await txlineClient.getFixturesSnapshot(COMPETITION_ID);
  rawFixturesCache = { at: Date.now(), data };
  return data;
}

export const realTxlineProvider: TxlineProvider = {
  async getFixtures(): Promise<Fixture[]> {
    if (fixturesCache && Date.now() - fixturesCache.at < FIXTURES_TTL) {
      return fixturesCache.data;
    }
    const raw = await getRawFixtures();
    // Enrich each fixture with live score/status (parallel scores snapshots).
    const fixtures = await Promise.all(
      raw.map(async (rf) => {
        try {
          const entries = await txlineClient.getScoresSnapshot(rf.FixtureId);
          const live = deriveLiveScore(String(rf.FixtureId), entries);
          return normalizeFixture(rf, live);
        } catch {
          return normalizeFixture(rf, null); // fall back to upcoming if scores fail
        }
      })
    );
    // Sort: live first, then upcoming (soonest), then finished.
    const order = { live: 0, upcoming: 1, finished: 2 } as const;
    fixtures.sort((a, b) => order[a.status] - order[b.status]);
    fixturesCache = { at: Date.now(), data: fixtures };
    return fixtures;
  },

  async getMatchDetail(fixtureId: string): Promise<MatchDetail | null> {
    const raw = await getRawFixtures();
    const rf = raw.find((x) => String(x.FixtureId) === String(fixtureId));
    if (!rf) return null;

    const snapshot = await txlineClient.getScoresSnapshot(fixtureId);
    const score = deriveLiveScore(String(fixtureId), snapshot);
    const stats = deriveStats(snapshot);
    const base = normalizeFixture(rf, score);

    // Timeline from the full chronological update sequence; fall back to snapshot.
    let events;
    try {
      const updates = await txlineClient.getScoresUpdates(fixtureId);
      events = buildEvents(updates.length ? updates : snapshot);
    } catch {
      events = buildEvents(snapshot);
    }

    return {
      fixtureId: String(fixtureId),
      teamA: base.teamA,
      teamB: base.teamB,
      round: base.round,
      kickoffTime: base.kickoffTime,
      score,
      events,
      stats,
      lineups: [],
    };
  },
};
