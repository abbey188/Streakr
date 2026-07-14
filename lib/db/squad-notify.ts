import { sql } from "./client";
import { sendPush } from "@/lib/push/server";

/**
 * Phase 4 — squad reply notifications. Kept separate from queries.ts so that
 * (pure, script-testable) DB module isn't coupled to the push layer; mirrors how
 * live-notify.ts is structured. Called from the messages route after a reply is
 * created. Reactions deliberately notify no one.
 *
 * Who gets pinged:
 *   - quote-reply to a MESSAGE → that message's author
 *   - reply in an EVENT thread → the event's owner + everyone already in the thread
 * Excludes the replier, dedupes, respects the `squad` pref, mirrors to Web Push.
 * Best-effort: never throws (a notify failure must not fail the send).
 */
export async function notifySquadReply(
  replier: string,
  body: string,
  parent: { type: "message" | "event"; id: string },
  messageId: string
): Promise<void> {
  try {
    let recipients: string[] = [];
    if (parent.type === "message") {
      const r = (await sql`select author_address from group_messages where id = ${parent.id}`) as { author_address: string }[];
      if (r[0]) recipients = [r[0].author_address];
    } else {
      const ev = (await sql`select actor_address from group_activity_events where id = ${parent.id}`) as { actor_address: string | null }[];
      const reps = (await sql`select distinct author_address from group_messages where parent_event_id = ${parent.id}`) as { author_address: string }[];
      recipients = [ev[0]?.actor_address ?? "", ...reps.map((x) => x.author_address)];
    }
    const targets = [...new Set(recipients.filter((a) => a && a !== replier))];
    if (targets.length === 0) return;

    const who = (await sql`select username from users where wallet_address = ${replier}`) as { username: string }[];
    const replierName = who[0]?.username;
    if (!replierName) return;

    const title = "New reply";
    const text = `@${replierName}: ${body.slice(0, 120)}`;

    // Gate by the `squad` pref; dedup on the message id so it can't double-insert.
    const rows = (await sql`
      insert into notifications (user_address, type, title, body, icon, dedup_key)
      select u.wallet_address, 'squad', ${title}, ${text}, '💬', ${messageId}
      from users u
      where u.wallet_address = any(${targets})
        and coalesce(u.notification_prefs->>'squad', '') <> 'false'
        and not exists (
          select 1 from notifications n
          where n.user_address = u.wallet_address and n.type = 'squad' and n.dedup_key = ${messageId}
        )
      returning user_address
    `) as { user_address: string }[];

    await Promise.all(
      rows.map((r) => sendPush(r.user_address, { title, body: text, icon: "💬", url: "/groups" }))
    );
  } catch (err) {
    console.error("notifySquadReply failed:", err);
  }
}

/**
 * Phase 5 — when a member shares a Live-Feed moment, ping the rest of the squad
 * so they come and argue (the "pull people in" half of the loop). Notifies every
 * OTHER member, gated by the `squad` pref, deduped on the message id, mirrored to
 * Web Push (deep-links to /groups). Best-effort: never throws.
 */
export async function notifySquadMomentShare(
  sharer: string,
  groupId: string,
  momentText: string,
  take: string,
  messageId: string
): Promise<void> {
  try {
    const members = (await sql`select user_address from group_members where group_id = ${groupId}`) as { user_address: string }[];
    const targets = [...new Set(members.map((m) => m.user_address).filter((a) => a && a !== sharer))];
    if (targets.length === 0) return;

    const who = (await sql`select username from users where wallet_address = ${sharer}`) as { username: string }[];
    const name = who[0]?.username;
    if (!name) return;

    const title = `${name} shared a moment`;
    const t = take.trim();
    const text = t ? `"${t.slice(0, 90)}" — ${momentText}` : momentText;

    const rows = (await sql`
      insert into notifications (user_address, type, title, body, icon, dedup_key)
      select u.wallet_address, 'squad', ${title}, ${text}, '📣', ${messageId}
      from users u
      where u.wallet_address = any(${targets})
        and coalesce(u.notification_prefs->>'squad', '') <> 'false'
        and not exists (
          select 1 from notifications n
          where n.user_address = u.wallet_address and n.type = 'squad' and n.dedup_key = ${messageId}
        )
      returning user_address
    `) as { user_address: string }[];

    await Promise.all(
      rows.map((r) => sendPush(r.user_address, { title, body: text, icon: "📣", url: "/groups" }))
    );
  } catch (err) {
    console.error("notifySquadMomentShare failed:", err);
  }
}
