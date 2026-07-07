import type { TxlineProvider, MatchDetail } from "./types";
import { txlineClient, type RawFixture } from "./client";
import { normalizeFixture, deriveLiveScore, deriveStats, deriveAdvancedStats, buildEvents } from "./normalize";

/**
 * Real TxLINE provider — pulls live World Cup data server-side and normalizes it.
 * The fixtures LIST is served from Neon (see lib/db/queries.getFixtures); this
 * provider only powers single-match detail. A short raw-snapshot cache keeps the
 * per-match lookup snappy without re-pulling the whole schedule each request.
 */

const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
// Without a start day, the fixtures snapshot only returns the handful of matches
// nearest "now" — so match-detail lookups for finished (and most other) fixtures
// 404'd. Anchor to the World Cup start so the snapshot covers the whole tournament.
const WC_START_EPOCH_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

// Brief per-instance cache of the raw whole-tournament snapshot that
// getMatchDetail scans. Scores are always fetched fresh per detail request.
let rawFixturesCache: { at: number; data: RawFixture[] } | null = null;
const FIXTURES_TTL = 30_000;

async function getRawFixtures(): Promise<RawFixture[]> {
  if (rawFixturesCache && Date.now() - rawFixturesCache.at < FIXTURES_TTL) {
    return rawFixturesCache.data;
  }
  const data = await txlineClient.getFixturesSnapshot(COMPETITION_ID, WC_START_EPOCH_DAY);
  rawFixturesCache = { at: Date.now(), data };
  return data;
}

export const realTxlineProvider: TxlineProvider = {
  async getMatchDetail(fixtureId: string): Promise<MatchDetail | null> {
    const raw = await getRawFixtures();
    const rf = raw.find((x) => String(x.FixtureId) === String(fixtureId));
    if (!rf) return null;

    const snapshot = await txlineClient.getScoresSnapshot(fixtureId);
    const score = deriveLiveScore(String(fixtureId), snapshot);
    const stats = deriveStats(snapshot); // corners/cards from the on-chain Stats map
    const base = normalizeFixture(rf, score);

    // Timeline + advanced stats (possession/shots/offsides) from the full action
    // log; fall back to the snapshot for the timeline if the stream is empty.
    let events;
    try {
      const updates = await txlineClient.getScoresUpdates(fixtureId);
      events = buildEvents(updates.length ? updates : snapshot);
      if (updates.length) Object.assign(stats, deriveAdvancedStats(updates));
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
