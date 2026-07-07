import { sql } from "./client";
import type { Fixture } from "@/src/types";
import type { DerivedGoal } from "@/lib/txline/normalize";
import { sendPush, type PushPayload } from "@/lib/push/server";

/** Mirror freshly-inserted notifications to Web Push. Best-effort (sendPush never
 *  throws); rows come from the insert's RETURNING so we push to EXACTLY the users
 *  who were newly notified (dedup already applied). */
async function pushToUsers(rows: { user_address: string }[], payload: PushPayload): Promise<void> {
  if (rows.length === 0) return;
  await Promise.all(rows.map((r) => sendPush(r.user_address, payload)));
}

/**
 * Generates live match notifications by diffing freshly-synced fixtures against
 * their previous DB state. MUST run BEFORE the fixtures are upserted, so the DB
 * still holds the old scores to compare against.
 *
 *  • Goals        — a team's score increased in a live match → tell everyone who
 *                   picked that fixture.
 *  • Kickoff      — an upcoming knockout match is within the sync window and the
 *                   user hasn't picked it yet → one reminder per user per match.
 *
 * Both respect per-user notification prefs. Results/badges/crowns are handled by
 * the resolution engine (also prefs-gated).
 */

interface OldFixtureRow {
  id: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
}

// Only remind about matches genuinely imminent (within this window before
// kickoff) — not every future fixture the full sync happens to touch.
const KICKOFF_SOON_MS = 45 * 60 * 1000;

export async function notifyLiveEvents(
  enriched: Fixture[],
  goalsByFixture: Map<string, DerivedGoal[]> = new Map()
): Promise<void> {
  if (enriched.length === 0) return;
  const ids = enriched.map((f) => f.id);

  const oldRows = (await sql`
    select id, score_a, score_b, status from fixtures where id = any(${ids})
  `) as OldFixtureRow[];
  const oldById = new Map(oldRows.map((r) => [r.id, r]));

  // Each block below is a single set-based INSERT…SELECT — the prefs check +
  // dedupe live in SQL, so the query count is constant no matter how many users
  // there are (no per-user round-trips). Muted = notification_prefs->>key is
  // 'false'; anything else (absent/'true') means the type is on.
  for (const f of enriched) {
    const old = oldById.get(f.id);

    // ── Goals: one notification per CONFIRMED goal ACTION ─────────────────
    // Keyed off the goal action's stable Seq (dedup_key), NOT a score-count
    // diff — so rapid doubles each fire, and a score flicker can't duplicate.
    if (f.status === "live") {
      const na = f.scoreA ?? 0, nb = f.scoreB ?? 0;
      for (const goal of goalsByFixture.get(f.id) ?? []) {
        // Only alert on RECENT goals — skip the match's whole back-catalogue so a
        // deploy / sync-gap doesn't re-blast every earlier goal. At a 15s sync a
        // real goal is seconds old; 5 min is generous headroom.
        if (Date.now() - goal.ts > 5 * 60 * 1000) continue;
        const teamName = goal.side === "A" ? f.teamA.name : f.teamB.name;
        const title = goal.scorer ? `Goal — ${goal.scorer}` : `Goal — ${teamName}`;
        const body = goal.scorer
          ? `${goal.scorer} scores for ${teamName}! ${f.teamA.code} ${na}–${nb} ${f.teamB.code}`
          : `${teamName} scored! ${f.teamA.code} ${na}–${nb} ${f.teamB.code}`;
        const key = goal.key; // stable per-goal identity (side + running score)
        const goalRows = (await sql`
          insert into notifications (user_address, type, title, body, icon, fixture_id, dedup_key)
          select p.user_address, 'goal', ${title}, ${body}, '⚽', ${f.id}, ${key}
          from picks p
          join users u on u.wallet_address = p.user_address
          where p.fixture_id = ${f.id}
            and coalesce(u.notification_prefs->>'goal', '') <> 'false'
            and not exists (
              select 1 from notifications n
              where n.user_address = p.user_address and n.fixture_id = ${f.id}
                and n.type = 'goal' and n.dedup_key = ${key}
            )
          on conflict do nothing
          returning user_address
        `) as { user_address: string }[];
        await pushToUsers(goalRows, {
          title, body, icon: "⚽", url: "/play", tag: `${f.id}-goal-${key}`,
        });
      }

      // ── Match started: the real first whistle only ──────────────────────
      // Fire ONLY on upcoming→live (not halftime→live for the 2nd half, and not
      // a finished→"live" mis-derivation blip), and dedupe so it can never
      // repeat for a user+match.
      if (old?.status === "upcoming") {
        const startBody = `${f.teamA.name} vs ${f.teamB.name} is underway.`;
        const startRows = (await sql`
          insert into notifications (user_address, type, title, body, icon, fixture_id)
          select p.user_address, 'match_start', 'Kickoff! 🏁',
                 ${startBody}, '🏁', ${f.id}
          from picks p
          join users u on u.wallet_address = p.user_address
          where p.fixture_id = ${f.id}
            and coalesce(u.notification_prefs->>'match_start', '') <> 'false'
            and not exists (
              select 1 from notifications n
              where n.user_address = p.user_address and n.fixture_id = ${f.id}
                and n.type = 'match_start' and n.title = 'Kickoff! 🏁'
            )
          on conflict do nothing
          returning user_address
        `) as { user_address: string }[];
        await pushToUsers(startRows, {
          title: "Kickoff! 🏁", body: startBody, icon: "🏁", url: "/play", tag: `${f.id}-start`,
        });
      }
    }

    // ── Kickoff reminder: upcoming knockout, imminent, user hasn't picked ──
    const kickoffMs = f.kickoffAt ? Date.parse(f.kickoffAt) : NaN;
    const imminent =
      Number.isFinite(kickoffMs) &&
      kickoffMs - Date.now() > 0 &&
      kickoffMs - Date.now() <= KICKOFF_SOON_MS;
    if (f.status === "upcoming" && f.round !== "Group Stage" && imminent) {
      const soonBody = `${f.teamA.name} vs ${f.teamB.name} is about to start — lock in your pick!`;
      const soonRows = (await sql`
        insert into notifications (user_address, type, title, body, icon, fixture_id)
        select u.wallet_address, 'match_start', 'Kickoff soon ⏰',
               ${soonBody}, '⏰', ${f.id}
        from users u
        where coalesce(u.notification_prefs->>'match_start', '') <> 'false'
          and not exists (
            select 1 from picks p where p.user_address = u.wallet_address and p.fixture_id = ${f.id}
          )
          and not exists (
            select 1 from notifications n
            where n.user_address = u.wallet_address and n.fixture_id = ${f.id} and n.type = 'match_start'
          )
        on conflict do nothing
        returning user_address
      `) as { user_address: string }[];
      await pushToUsers(soonRows, {
        title: "Kickoff soon ⏰", body: soonBody, icon: "⏰", url: "/play", tag: `${f.id}-soon`,
      });
    }
  }
}
