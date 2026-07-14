export interface AvatarConfig {
  skinTone: string; // hex or color class
  kitPrimary: string; // Tailwind class or hex
  kitSecondary: string; // Tailwind class or hex
  expression: string; // key of expression
  username: string;
  jerseyNumber?: string;
  headgear?: string;
  nation?: string; // self-declared "backing nation" flag emoji (World Cup)
}

export interface Team {
  id: string;
  name: string;
  flag: string; // emoji or SVG representation
  code: string; // e.g. "BRA", "FRA"
}

export interface Fixture {
  id: string;
  round: string; // "Round of 16" | "Quarterfinals" | "Semifinals" | "Third Place" | "Final"
  teamA: Team;
  teamB: Team;
  status: "live" | "upcoming" | "finished";
  scoreA?: number;
  scoreB?: number;
  minute?: number; // only if live
  period?: string; // "1H" | "HT" | "2H" | "ET1" | "ET2" | "PENS" | … — for ET/stoppage display
  kickoffTime: string; // e.g. "20:00" (display fallback)
  kickoffAt?: string; // ISO timestamp — used for accurate local time + day grouping
  updatedAt?: string; // ISO timestamp of last sync — anchors the live-minute tick
  userPick?: "A" | "B";
  actualWinner?: "A" | "B"; // filled if finished
  // Fan pick-consensus: how the app split on who advances. Counts, not %, so the
  // UI can apply its own small-sample threshold and show the total honestly.
  pickCounts?: { a: number; b: number };
  // Pick window (Issue 5): open until the first goal / red card / 2nd-half kickoff.
  // Computed server-side during sync. undefined ⇒ treat as open if upcoming.
  pickOpen?: boolean;
  pickCloseReason?: "goal" | "red" | "secondhalf" | "finished" | null;
}

// ─── Live Feed ────────────────────────────────────────────────────────────
// The Hub's scrollable moment feed, powered by TxLINE via match_events. Each
// item is one match moment (goal/card/sub/VAR/shot) with the match context it
// needs to render on its own (flags, country, score, minute) and to be shared
// into a squad. See docs/social/LIVE_FEED.md.

/** The match a feed moment belongs to — enough to render context standalone. */
export interface FeedMatch {
  fixtureId: string;
  round: string;
  status: "live" | "upcoming" | "finished";
  period?: string | null; // "2H" | "ET" | "PENS" | "FT" | …
  minute?: number | null; // live match minute
  scoreA?: number | null;
  scoreB?: number | null;
  winner?: "A" | "B" | null; // who advanced (filled at full-time)
  teamA: Team;
  teamB: Team;
}

/** One moment in the Live Feed. `payload` carries type-specific detail
 *  (side, scorer/player, on/off, outcome, penalty, cardType). */
export interface FeedItem {
  id: string; // stable: `${fixtureId}:${eventKey}`
  fixtureId: string;
  type: string; // goal | penalty | penalty_missed | yellow | red | sub | var | shot
  minute?: number | null;
  createdAt: string; // ISO — orders the feed + powers "x min ago"
  payload: Record<string, unknown>;
  match: FeedMatch;
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // lucide icon name or emoji
  description: string;
  color: string;
}

export interface GroupMember {
  id: string;
  rank: number;
  username: string;
  avatar: AvatarConfig;
  streak: number;
  change: "up" | "down" | "same";
  isCurrentUser?: boolean;
}

export interface ActivityItem {
  id: string;
  type: "milestone" | "break" | "win" | "badge";
  username: string;
  avatar: AvatarConfig;
  message: string;
  timestamp: string;
  reactions: { [emoji: string]: number };
  isMine?: boolean; // the actor is the viewer → render "You" instead of "@name"
}

// ─── Squad Room (per-group social stream) — see docs/social/SQUAD_ROOM.md ────

/** A reaction on a squad item, with the viewer's own state so the bar can
 *  render "yours" (filled) vs others. */
export interface SquadReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

/** A one-level reply under a squad item (a message or a system event). */
export interface SquadReply {
  id: string;
  username: string;
  avatar: AvatarConfig;
  body: string;
  timestamp: string;
  isMine: boolean;
  deleted?: boolean;
}

/**
 * One root row in the Squad Room stream: either a system match-event or a
 * member message. Both are mascot-led; `kind` (+ `eventType` for events) drives
 * the visual treatment — coloured edge + type chip for events, bubble for
 * messages. Events are never "mine".
 */
export interface SquadItem {
  id: string;
  kind: "event" | "message";
  eventType?: "milestone" | "break" | "win" | "badge"; // set when kind === "event"
  username: string;
  avatar: AvatarConfig;
  body: string;        // the event message OR the message text
  timestamp: string;
  isMine: boolean;     // authored by the viewer (events are always false)
  reactions: SquadReaction[];
  // Event threads nest here (Slack-style). Messages never nest — a reply to a
  // message is its own root carrying `quoted` (Telegram-style).
  replies: SquadReply[];
  quoted?: { username: string; body: string; isMine: boolean; deleted?: boolean } | null;
  deleted?: boolean;
}

/** A personal, addressed-to-you notification (pick result, badge, round champion,
 *  a milestone from someone in one of your groups, or an app-wide announcement).
 *  Must match the `type` values actually inserted into `notifications`. */
export interface Notification {
  id: string;
  type:
    | "pick_result" | "badge" | "round_champion" | "goal" | "match_start"
    | "group" | "announcement" | "squad";
  title: string;
  body: string;
  icon: string;
  read: boolean;
  timestamp: string; // relative display string, e.g. "2h ago"
}
