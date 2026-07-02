/**
 * Notification type keys + the shared opt-out check. A type is ON unless the
 * user's `notification_prefs` explicitly sets it to false (empty prefs = all on),
 * so brand-new users get everything by default.
 */
export type NotifType =
  | "match_start"
  | "goal"
  | "pick_result"
  | "badge"
  | "round_champion"
  | "group";

export const NOTIF_TYPES: { key: NotifType; label: string; description: string }[] = [
  { key: "match_start", label: "Match reminders", description: "A match you haven't picked is about to kick off" },
  { key: "goal", label: "Goals", description: "Goals in matches you've picked" },
  { key: "pick_result", label: "Pick results", description: "Whether your pick won or lost" },
  { key: "badge", label: "Badges", description: "New badges you unlock" },
  { key: "round_champion", label: "Round Champion", description: "When you're crowned champion of a round" },
  { key: "group", label: "Group updates", description: "Milestones from your groups (streaks, crowns)" },
];

export function prefAllows(
  prefs: Record<string, boolean> | null | undefined,
  type: string
): boolean {
  return !prefs || prefs[type] !== false;
}
