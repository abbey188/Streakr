import type { Fixture } from "@/src/types";
import { INITIAL_FIXTURES } from "@/src/data/fixtures";
import type {
  TxlineProvider, MatchDetail, MatchEvent, MatchStats, Lineup, LiveScore, MatchStatus,
} from "./types";

/**
 * Mock TxLINE provider — realistic fake data so the whole Hub + resolution can
 * be built and demoed before the real TxLINE token is wired. Same interface as
 * the real client, so swapping is a one-line change in getTxlineProvider().
 */

const SAMPLE_NAMES_A = ["G. Costa", "L. Marín", "R. Vidal", "T. Silva", "N. Kanté", "F. Mendy", "K. Adeyemi", "D. Rice", "P. Foden", "H. Kane", "J. Bellingham"];
const SAMPLE_NAMES_B = ["A. Morata", "P. Torres", "S. Busquets", "M. Llorente", "F. Torres", "J. Alba", "D. Olmo", "R. Lewa", "V. Osimhen", "E. Haaland", "K. Mbappé"];

function statusOf(f: Fixture): MatchStatus {
  if (f.status === "live") return "live";
  if (f.status === "finished") return "finished";
  return "upcoming";
}

function buildLineup(team: "A" | "B"): Lineup {
  const names = team === "A" ? SAMPLE_NAMES_A : SAMPLE_NAMES_B;
  return {
    team,
    formation: "4-3-3",
    players: names.map((name, i) => ({ id: `${team}-${i}`, name, number: i + 1 })),
  };
}

// Deterministic-ish goal minutes spread across the match for a given count.
function goalMinutes(count: number, offset: number): number[] {
  const mins: number[] = [];
  for (let i = 0; i < count; i++) mins.push(((offset + i + 1) * 17) % 89 + 3);
  return mins.sort((a, b) => a - b);
}

function buildEvents(f: Fixture): MatchEvent[] {
  const a = f.scoreA ?? 0;
  const b = f.scoreB ?? 0;
  const events: MatchEvent[] = [];
  goalMinutes(a, 0).forEach((m, i) =>
    events.push({ id: `${f.id}-ga-${i}`, minute: m, team: "A", type: "goal", detail: SAMPLE_NAMES_A[i % SAMPLE_NAMES_A.length] })
  );
  goalMinutes(b, 3).forEach((m, i) =>
    events.push({ id: `${f.id}-gb-${i}`, minute: m, team: "B", type: "goal", detail: SAMPLE_NAMES_B[i % SAMPLE_NAMES_B.length] })
  );
  // A couple of cards/corners for colour (only for live/finished).
  if (f.status !== "upcoming") {
    events.push({ id: `${f.id}-y1`, minute: 34, team: "B", type: "yellow", detail: SAMPLE_NAMES_B[2] });
    events.push({ id: `${f.id}-c1`, minute: 51, team: "A", type: "corner" });
    if ((f.minute ?? 90) > 60) {
      events.push({ id: `${f.id}-s1`, minute: 63, team: "A", type: "sub", detail: "Tactical change" });
    }
  }
  return events.sort((a, b) => a.minute - b.minute);
}

function buildStats(f: Fixture): MatchStats {
  if (f.status === "upcoming") return {};
  const possA = 45 + ((f.id.charCodeAt(1) || 5) % 20);
  return {
    possessionA: possA,
    possessionB: 100 - possA,
    shotsA: 8 + ((f.scoreA ?? 0) * 2),
    shotsB: 6 + ((f.scoreB ?? 0) * 2),
    shotsOnTargetA: 3 + (f.scoreA ?? 0),
    shotsOnTargetB: 2 + (f.scoreB ?? 0),
    cornersA: 4,
    cornersB: 3,
    yellowA: 1,
    yellowB: 2,
    redA: 0,
    redB: 0,
  };
}

function buildScore(f: Fixture): LiveScore {
  const status = statusOf(f);
  return {
    fixtureId: f.id,
    status,
    minute: f.minute,
    period: status === "live" ? "2H" : status === "finished" ? "FT" : undefined,
    homeScore: f.scoreA ?? 0,
    awayScore: f.scoreB ?? 0,
    advanced: f.actualWinner, // set for finished knockouts
  };
}

export const mockTxlineProvider: TxlineProvider = {
  async getMatchDetail(fixtureId: string): Promise<MatchDetail | null> {
    const f = INITIAL_FIXTURES.find((x) => x.id === fixtureId);
    if (!f) return null;
    return {
      fixtureId,
      teamA: f.teamA,
      teamB: f.teamB,
      round: f.round,
      kickoffTime: f.kickoffTime,
      score: buildScore(f),
      events: buildEvents(f),
      stats: buildStats(f),
      lineups: [buildLineup("A"), buildLineup("B")],
    };
  },
};
