/**
 * Server-side TxLINE HTTP client. Holds the activated API token and manages a
 * short-lived guest JWT (refreshed automatically). Every data call sends both
 * `Authorization: Bearer <jwt>` and `X-Api-Token: <apiToken>`.
 *
 * Server-only — the API token never reaches the browser.
 */

const BASE = process.env.TXLINE_API_BASE_URL || "https://txline.txodds.com";
const API_TOKEN = process.env.TXLINE_API_TOKEN || "";

let cachedJwt: string | null = null;
let jwtFetchedAt = 0;
const JWT_TTL_MS = 4 * 60 * 1000; // refresh conservatively; also refresh on 401

async function getJwt(force = false): Promise<string> {
  if (!force && cachedJwt && Date.now() - jwtFetchedAt < JWT_TTL_MS) return cachedJwt;
  const res = await fetch(`${BASE}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`TxLINE guest auth failed: ${res.status}`);
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error("TxLINE guest auth returned no token");
  cachedJwt = json.token;
  jwtFetchedAt = Date.now();
  return cachedJwt;
}

/** GET a TxLINE data endpoint (path under /api). Refreshes the JWT once on 401. */
async function txlineGet<T>(path: string): Promise<T> {
  if (!API_TOKEN) throw new Error("TXLINE_API_TOKEN not set");
  const doFetch = async (jwt: string) =>
    fetch(`${BASE}/api${path}`, {
      headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": API_TOKEN },
    });

  let res = await doFetch(await getJwt());
  if (res.status === 401) res = await doFetch(await getJwt(true)); // stale JWT → refresh once
  if (!res.ok) throw new Error(`TxLINE GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * GET an endpoint that returns SSE-style text (`data: {json}` lines) as a fixed
 * body, and parse it into entries. Aborts after `timeoutMs` so a live stream
 * that stays open doesn't block the request.
 */
async function txlineGetSse(path: string, timeoutMs = 8000): Promise<RawScoreEntry[]> {
  if (!API_TOKEN) throw new Error("TXLINE_API_TOKEN not set");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      headers: { Authorization: `Bearer ${await getJwt()}`, "X-Api-Token": API_TOKEN },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`TxLINE GET ${path} failed: ${res.status}`);
    const text = await res.text();
    const out: RawScoreEntry[] = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { out.push(JSON.parse(payload) as RawScoreEntry); } catch { /* skip */ }
    }
    return out;
  } catch {
    return []; // timeout/abort/parse issues → caller falls back to snapshot
  } finally {
    clearTimeout(timer);
  }
}

export const txlineClient = {
  isConfigured: () => Boolean(API_TOKEN),
  baseUrl: BASE,
  apiToken: () => API_TOKEN,
  getJwt,

  /** Raw fixtures for a competition (72 = World Cup). `startEpochDay` pulls
   *  history (fixtures within 30 days after that day). */
  getFixturesSnapshot: (competitionId: number, startEpochDay?: number) =>
    txlineGet<RawFixture[]>(
      `/fixtures/snapshot?competitionId=${competitionId}` +
        (startEpochDay != null ? `&startEpochDay=${startEpochDay}` : "")
    ),

  /** Raw scores snapshot (latest state per action) for a fixture. */
  getScoresSnapshot: (fixtureId: string | number) =>
    txlineGet<RawScoreEntry[]>(`/scores/snapshot/${fixtureId}`),

  /** Chronological score updates for a fixture (SSE text → parsed entries). */
  getScoresUpdates: (fixtureId: string | number) =>
    txlineGetSse(`/scores/updates/${fixtureId}`),
};

// ─── Raw TxLINE shapes (only the fields we consume) ─────────────────────────

export interface RawFixture {
  FixtureId: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number; // stage cluster: group stage vs each knockout round
  Participant1: string;
  Participant1Id: number;
  Participant2: string;
  Participant2Id: number;
  Participant1IsHome: boolean;
  StartTime: number; // epoch ms
}

export interface RawPeriodScore {
  Goals?: number;
  Corners?: number;
  YellowCards?: number;
  RedCards?: number;
}

export interface RawTotalScore {
  H1?: RawPeriodScore; HT?: RawPeriodScore; H2?: RawPeriodScore;
  ET1?: RawPeriodScore; ET2?: RawPeriodScore; PE?: RawPeriodScore;
  ETTotal?: RawPeriodScore; Total?: RawPeriodScore;
}

export interface RawScore {
  Participant1?: RawTotalScore;
  Participant2?: RawTotalScore;
}

export interface RawScoreEntry {
  FixtureId: number;
  Action: string;
  GameState?: string;
  StatusId?: number;
  Ts: number;
  Seq: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: RawScore;
  Stats?: Record<string, number>;
  Data?: Record<string, unknown>;
}
