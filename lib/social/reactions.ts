/**
 * The fixed Squad Room reaction set. A closed palette keeps reactions fast to
 * tap and on-brand — every emoji already means something in Streakr's world
 * (🔥 streak, 💀 break, 👑 crown). Shared by the server (validation) and the
 * client (the palette UI), so the two can never drift.
 */
export const SQUAD_REACTIONS = ["🔥", "👏", "😂", "💀", "😮", "👑"] as const;

export type SquadReactionEmoji = (typeof SQUAD_REACTIONS)[number];

export function isSquadReaction(e: string): e is SquadReactionEmoji {
  return (SQUAD_REACTIONS as readonly string[]).includes(e);
}
