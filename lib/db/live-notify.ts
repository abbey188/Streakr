import { sql } from "./client";
import type { Fixture } from "@/src/types";
import { prefAllows } from "./notify-prefs";

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

export async function notifyLiveEvents(enriched: Fixture[]): Promise<void> {
  if (enriched.length === 0) return;
  const ids = enriched.map((f) => f.id);

  const oldRows = (await sql`
    select id, score_a, score_b, status from fixtures where id = any(${ids})
  `) as OldFixtureRow[];
  const oldById = new Map(oldRows.map((r) => [r.id, r]));

  for (const f of enriched) {
    const old = oldById.get(f.id);

    // ── Goals: per-team score increase in a live match ────────────────────
    if (f.status === "live" && old) {
      const na = f.scoreA ?? 0, nb = f.scoreB ?? 0;
      const oa = old.score_a ?? 0, ob = old.score_b ?? 0;
      const scored: string[] = [];
      if (na > oa) scored.push(f.teamA.name);
      if (nb > ob) scored.push(f.teamB.name);

      if (scored.length) {
        const pickers = (await sql`
          select p.user_address, u.notification_prefs
          from picks p join users u on u.wallet_address = p.user_address
          where p.fixture_id = ${f.id}
        `) as { user_address: string; notification_prefs: Record<string, boolean> | null }[];

        for (const team of scored) {
          for (const pk of pickers) {
            if (!prefAllows(pk.notification_prefs, "goal")) continue;
            await sql`
              insert into notifications (user_address, type, title, body, icon, fixture_id)
              values (${pk.user_address}, 'goal', ${`Goal — ${team}`},
                      ${`${team} scored! ${f.teamA.code} ${na}–${nb} ${f.teamB.code}`}, '⚽', ${f.id})
            `;
          }
        }
      }
    }

    // ── Kickoff reminder: upcoming knockout, imminent, user hasn't picked ──
    const kickoffMs = f.kickoffAt ? Date.parse(f.kickoffAt) : NaN;
    const imminent =
      Number.isFinite(kickoffMs) &&
      kickoffMs - Date.now() > 0 &&
      kickoffMs - Date.now() <= KICKOFF_SOON_MS;
    if (f.status === "upcoming" && f.round !== "Group Stage" && imminent) {
      const toRemind = (await sql`
        select u.wallet_address, u.notification_prefs
        from users u
        where not exists (
          select 1 from picks p where p.user_address = u.wallet_address and p.fixture_id = ${f.id}
        )
        and not exists (
          select 1 from notifications n
          where n.user_address = u.wallet_address and n.fixture_id = ${f.id} and n.type = 'match_start'
        )
      `) as { wallet_address: string; notification_prefs: Record<string, boolean> | null }[];

      for (const u of toRemind) {
        if (!prefAllows(u.notification_prefs, "match_start")) continue;
        await sql`
          insert into notifications (user_address, type, title, body, icon, fixture_id)
          values (${u.wallet_address}, 'match_start', 'Kickoff soon ⏰',
                  ${`${f.teamA.name} vs ${f.teamB.name} is about to start — lock in your pick!`}, '⏰', ${f.id})
        `;
      }
    }
  }
}
