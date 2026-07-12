/**
 * Group/squad event messages are stored third-person predicates ("hit a
 * 5-match streak", "was crowned … Champion"). We prepend the actor — "@Name" or
 * "You". Most predicates read fine after "You" ("You hit…", "You lost…", "You
 * unlocked…"); the only conjugation that breaks is "was" → "were". This fixes it
 * so "You was crowned" becomes "You were crowned". Shared by the Inbox and the
 * Squad Room so the two never diverge.
 */
export function eventPredicate(message: string, isMine?: boolean): string {
  return isMine ? message.replace(/^was\b/, "were") : message;
}
