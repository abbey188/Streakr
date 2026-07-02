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
  round: string; // "Round of 16" | "Quarterfinals" | "Semifinals" | "Final"
  teamA: Team;
  teamB: Team;
  status: "live" | "upcoming" | "finished";
  scoreA?: number;
  scoreB?: number;
  minute?: number; // only if live
  kickoffTime: string; // e.g. "20:00" (display fallback)
  kickoffAt?: string; // ISO timestamp — used for accurate local time + day grouping
  userPick?: "A" | "B";
  actualWinner?: "A" | "B"; // filled if finished
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
}

/** A personal, addressed-to-you notification (pick result, badge, round champion). */
export interface Notification {
  id: string;
  type: "pick_result" | "badge" | "round_champion" | "streak" | "goal" | "match_start";
  title: string;
  body: string;
  icon: string;
  read: boolean;
  timestamp: string; // relative display string, e.g. "2h ago"
}
