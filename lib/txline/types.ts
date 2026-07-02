import type { Fixture, Team } from "@/src/types";

/**
 * Normalized, app-facing TxLINE data model. TxLINE's raw payloads (see
 * Documantation.md) are mapped into these clean shapes by the real client's
 * normalizer, so the rest of the app never touches TxLINE's wire format.
 *
 * Teams are always "A"/"B" to align with our Fixture.teamA/teamB and pick model.
 */

export type MatchStatus = "upcoming" | "live" | "halftime" | "finished";

/** Live/finished scoreline + status. */
export interface LiveScore {
  fixtureId: string;
  status: MatchStatus;
  minute?: number; // current match minute while live
  period?: string; // "1H" | "HT" | "2H" | "ET" | "PENS" | "FT"
  homeScore: number;
  awayScore: number;
  homePenalties?: number; // shootout tally (knockouts)
  awayPenalties?: number;
  /** Who advances — filled at full-time for knockouts (drives pick resolution). */
  advanced?: "A" | "B";
}

export type MatchEventType =
  | "goal" | "yellow" | "red" | "corner" | "penalty" | "var" | "sub" | "freekick";

/** A single timeline action (goal, card, corner, sub, …). */
export interface MatchEvent {
  id: string;
  minute: number;
  team: "A" | "B";
  type: MatchEventType;
  detail?: string; // e.g. "Header", scorer name, "Penalty saved"
}

/** Aggregate match stats (SofaScore-style bars). */
export interface MatchStats {
  possessionA?: number; // %
  possessionB?: number;
  shotsA?: number;
  shotsB?: number;
  shotsOnTargetA?: number;
  shotsOnTargetB?: number;
  cornersA?: number;
  cornersB?: number;
  yellowA?: number;
  yellowB?: number;
  redA?: number;
  redB?: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  number?: number;
}

export interface Lineup {
  team: "A" | "B";
  formation?: string;
  players: LineupPlayer[];
}

/** A team's single past result (for last-5 form dots). */
export interface FormEntry {
  result: "W" | "D" | "L";
  scoreFor: number;
  scoreAgainst: number;
  opponentCode: string;
}

/** Everything the Hub shows for one match. */
export interface MatchDetail {
  fixtureId: string;
  teamA: Team;
  teamB: Team;
  round: string;
  kickoffTime: string;
  score: LiveScore;
  events: MatchEvent[];
  stats: MatchStats;
  lineups: Lineup[];
}

/**
 * Swappable data source. The mock implementation returns realistic fake data;
 * the real implementation proxies TxLINE (server-side). Selected by
 * getTxlineProvider() based on whether a TxLINE token is configured.
 */
export interface TxlineProvider {
  /** All fixtures (normalized to our Fixture shape). */
  getFixtures(): Promise<Fixture[]>;
  /** Full detail (score + events + stats + lineups) for one fixture. */
  getMatchDetail(fixtureId: string): Promise<MatchDetail | null>;
}
