import { sql } from "./client";
import { BADGES } from "@/src/data/fixtures";
import { prefAllows } from "./notify-prefs";
import { sendPush } from "@/lib/push/server";

/**
 * Resolution engine: turns finished match results into resolved picks, updated
 * streaks/points, badge awards, and notifications.
 *
 * Design (see project_streakr_scoring_model):
 *  - A pick is correct iff pick === fixtures.actual_winner (who advanced).
 *  - Streak/points/personal_best are RECOMPUTED from a user's resolved-pick
 *    history ordered by kickoff — idempotent + robust to out-of-order finishes.
 *  - Points: +10 × (new streak length) per correct pick; never lost on a miss.
 *  - Threshold badges award when personal_best / points cross a bar.
 */

const BADGE_INFO = Object.fromEntries(BADGES.map((b) => [b.id, b]));

// Streak/points milestone badges (social + round badges handled elsewhere).
const THRESHOLD_BADGES: { id: string; metric: "best" | "points"; value: number }[] = [
  { id: "b1", metric: "best", value: 1 },   // First Blood
  { id: "b2", metric: "best", value: 3 },   // Hat-Trick Hero
  { id: "b3", metric: "best", value: 5 },   // On Fire
  { id: "b4", metric: "best", value: 10 },  // World Class
  { id: "b5", metric: "best", value: 15 },  // Unstoppable
  { id: "b6", metric: "best", value: 20 },  // GOAT
  { id: "b7", metric: "points", value: 500 },   // Rising Star
  { id: "b8", metric: "points", value: 1500 },  // Elite Streakr
  { id: "b9", metric: "points", value: 3000 },  // Oracle
];

// Knockout rounds we crown a Round Champion for (SF=2 / Final=1 too few — those
// get per-pick prestige badges instead).
const CHAMPION_ROUNDS = ["Round of 32", "Round of 16", "Quarterfinals"];

// Sentinel "round" for the overall tournament crown in round_champions.
const TOURNAMENT_ROUND = "Tournament";

// Active-streak lengths worth announcing to a user's groups (no spam on every win).
const NOTABLE_STREAKS = new Set([3, 5, 7, 10, 15, 20]);

/**
 * Fan a milestone event out to every group the user belongs to. Read-only
 * feed (no reactions) — powers the Inbox "From your groups" section. Emits
 * nothing if the user isn't in any group.
 */
async function emitGroupEvent(
  address: string, type: "milestone" | "win" | "badge", message: string
) {
  await sql`
    insert into group_activity_events (group_id, actor_address, type, message)
    select gm.group_id, ${address}, ${type}, ${message}
    from group_members gm
    where gm.user_address = ${address}
  `;
}

async function createNotification(
  address: string, type: string, title: string, body: string, icon: string
) {
  // Respect the user's per-type opt-outs (empty prefs = all on).
  const rows = (await sql`
    select notification_prefs from users where wallet_address = ${address}
  `) as { notification_prefs: Record<string, boolean> | null }[];
  if (!prefAllows(rows[0]?.notification_prefs, type)) return;

  await sql`
    insert into notifications (user_address, type, title, body, icon)
    values (${address}, ${type}, ${title}, ${body}, ${icon})
  `;
  // Mirror to Web Push (best-effort; sendPush never throws). Badges deep-link to
  // the profile; everything else to Play.
  await sendPush(address, {
    title, body, icon: icon || undefined,
    url: type === "badge" ? "/profile" : "/play",
  });
}

/** Grant a badge; returns true iff it was newly awarded (fires no notification). */
async function grantBadge(address: string, badgeId: string): Promise<boolean> {
  const res = (await sql`
    insert into user_badges (user_address, badge_id) values (${address}, ${badgeId})
    on conflict do nothing returning badge_id
  `) as { badge_id: string }[];
  return res.length > 0;
}

/** Grant a badge and, if new, fire the milestone notification. */
async function grantBadgeAndNotify(address: string, badgeId: string) {
  if (!(await grantBadge(address, badgeId))) return;
  const badge = BADGE_INFO[badgeId];
  if (!badge) return;
  await createNotification(address, "badge",
    `Badge unlocked: ${badge.name}`,
    `You're on a hot streak — ${badge.name} ${badge.icon} is yours!`, badge.icon);
}

/** Recompute a user's streak/best/points from their resolved picks (kickoff order). */
async function recomputeUser(address: string): Promise<{ streak: number; best: number; points: number }> {
  const rows = (await sql`
    select p.correct
    from picks p
    join fixtures f on f.id = p.fixture_id
    where p.user_address = ${address} and p.resolved = true
    order by f.kickoff_at asc nulls last, f.id asc
  `) as { correct: boolean | null }[];

  let streak = 0, best = 0, points = 0;
  for (const r of rows) {
    if (r.correct) {
      streak += 1;
      points += 10 * streak;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  await sql`
    update users set current_streak = ${streak}, personal_best = ${best}, points = ${points}
    where wallet_address = ${address}
  `;
  return { streak, best, points };
}

/** Award any newly-crossed threshold badges (with notifications). */
async function awardThresholdBadges(address: string, best: number, points: number) {
  for (const b of THRESHOLD_BADGES) {
    const val = b.metric === "best" ? best : points;
    if (val >= b.value) await grantBadgeAndNotify(address, b.id);
  }
}

interface FinishedFixtureRow {
  id: string;
  round: string;
  actual_winner: "A" | "B";
  team_a_name: string;
  team_b_name: string;
}

/**
 * Resolves all finished fixtures that still have unresolved picks, then
 * recomputes affected users + awards badges + fires notifications.
 * Idempotent: already-resolved picks are skipped, so it's safe to re-run.
 */
export async function resolveFinishedFixtures(): Promise<{ resolvedFixtures: number; affectedUsers: number }> {
  const fixtures = (await sql`
    select f.id, f.round, f.actual_winner, ta.name as team_a_name, tb.name as team_b_name
    from fixtures f
    join teams ta on ta.id = f.team_a_id
    join teams tb on tb.id = f.team_b_id
    where f.status = 'finished' and f.actual_winner is not null
      and exists (select 1 from picks p where p.fixture_id = f.id and p.resolved = false)
  `) as FinishedFixtureRow[];

  const affected = new Set<string>();
  // Correct picks on Semifinals / Final earn per-pick prestige badges.
  const prestige: { address: string; badgeId: string }[] = [];

  for (const f of fixtures) {
    const advancedName = f.actual_winner === "A" ? f.team_a_name : f.team_b_name;
    const unresolved = (await sql`
      select user_address, pick from picks where fixture_id = ${f.id} and resolved = false
    `) as { user_address: string; pick: "A" | "B" }[];

    await sql`
      update picks set resolved = true, correct = (pick = ${f.actual_winner}), resolved_at = now()
      where fixture_id = ${f.id} and resolved = false
    `;

    for (const p of unresolved) {
      affected.add(p.user_address);
      const correct = p.pick === f.actual_winner;
      const pickedName = p.pick === "A" ? f.team_a_name : f.team_b_name;
      if (correct) {
        await createNotification(p.user_address, "pick_result",
          "Nailed it!", `${advancedName} advanced — your pick came through. Streak lives on! 🔥`, "✅");
        if (f.round === "Semifinals") prestige.push({ address: p.user_address, badgeId: "b15" });
        else if (f.round === "Final") prestige.push({ address: p.user_address, badgeId: "b16" });
      } else {
        await createNotification(p.user_address, "pick_result",
          "Heartbreak", `${pickedName} crashed out. Streak reset — we go again. 💪`, "💔");
      }
    }
  }

  for (const address of affected) {
    const { streak, best, points } = await recomputeUser(address);
    await awardThresholdBadges(address, best, points);
    // Announce notable active streaks to the user's groups (once per crossing —
    // affected only contains users with newly-resolved picks this run).
    if (NOTABLE_STREAKS.has(streak)) {
      await emitGroupEvent(address, "milestone", `hit a ${streak}-match streak! 🔥`);
    }
  }
  for (const { address, badgeId } of prestige) {
    await grantBadgeAndNotify(address, badgeId);
  }

  // Crown Round Champions for any newly-completed knockout round.
  await crownRoundChampions();

  // The overall "The Streakr" crown, once the Final is settled. Failure-isolated:
  // a crowning error must never break pick resolution.
  try {
    await crownTournamentChampion();
  } catch (err) {
    console.error("[resolution] tournament crowning failed:", err);
  }

  return { resolvedFixtures: fixtures.length, affectedUsers: affected.size };
}

/**
 * For each eligible knockout round that is now fully finished, crown the
 * champion (most correct picks, tiebreak current streak) globally and per
 * group, and award Perfect Round to anyone who called the whole round.
 * Idempotent via the round_champions unique index.
 */
async function crownRoundChampions() {
  for (const round of CHAMPION_ROUNDS) {
    const tallot = (await sql`
      select count(*)::int as total,
             count(*) filter (where status = 'finished')::int as done
      from fixtures where round = ${round}
    `) as { total: number; done: number }[];
    const { total, done } = tallot[0];
    if (total === 0 || done < total) continue; // round not complete yet

    // Global champion.
    const global = (await sql`
      select p.user_address, count(*) filter (where p.correct)::int as correct_count
      from picks p
      join fixtures f on f.id = p.fixture_id
      join users u on u.wallet_address = p.user_address
      where f.round = ${round} and p.resolved = true
      group by p.user_address, u.current_streak
      having count(*) filter (where p.correct) > 0
      order by correct_count desc, u.current_streak desc
      limit 1
    `) as { user_address: string; correct_count: number }[];
    if (global.length) {
      await crown(round, null, global[0].user_address, global[0].correct_count, "the world");
    }

    // Per-group champions.
    const groups = (await sql`select id, name from groups`) as { id: string; name: string }[];
    for (const g of groups) {
      const champ = (await sql`
        select p.user_address, count(*) filter (where p.correct)::int as correct_count
        from picks p
        join fixtures f on f.id = p.fixture_id
        join group_members gm on gm.user_address = p.user_address
        join users u on u.wallet_address = p.user_address
        where f.round = ${round} and p.resolved = true and gm.group_id = ${g.id}
        group by p.user_address, u.current_streak
        having count(*) filter (where p.correct) > 0
        order by correct_count desc, u.current_streak desc
        limit 1
      `) as { user_address: string; correct_count: number }[];
      if (champ.length) {
        await crown(round, g.id, champ[0].user_address, champ[0].correct_count, g.name);
      }
    }

    // Perfect Round: picked every match in the round AND got them all right.
    const perfect = (await sql`
      select p.user_address
      from picks p
      join fixtures f on f.id = p.fixture_id
      where f.round = ${round} and p.resolved = true
      group by p.user_address
      having count(*) = ${total} and count(*) filter (where p.correct) = ${total}
    `) as { user_address: string }[];
    for (const u of perfect) {
      if (await grantBadge(u.user_address, "b14")) {
        await createNotification(u.user_address, "badge",
          "Badge unlocked: Perfect Round",
          `Flawless ${round} — every single pick correct. 💯`, "💯");
      }
    }
  }
}

/** Record a champion crown (idempotent) and notify + award the trophy badge if new. */
async function crown(
  round: string, groupId: string | null, address: string, count: number, scopeLabel: string
) {
  const res = (await sql`
    insert into round_champions (round, group_id, user_address, correct_count)
    values (${round}, ${groupId}, ${address}, ${count})
    on conflict do nothing returning id
  `) as { id: string }[];
  if (!res.length) return; // already crowned for this (round, scope)

  await grantBadge(address, "b13");
  const where = groupId ? `${scopeLabel}` : "the whole tournament";
  await createNotification(address, "round_champion",
    `${round} Champion 🏆`,
    `You topped ${where} in the ${round} with ${count} correct picks. Take a bow.`, "🏆");
  // Global crown → tell their groups (per-group crowns would double-announce).
  if (!groupId) {
    await emitGroupEvent(address, "win", `was crowned ${round} Champion with ${count} correct picks! 🏆`);

    // Broadcast the crowning to EVERYONE who picked in this round (except the
    // champion, who got the personal note above) so it's visible community-wide,
    // not just to the winner. Prefs-respected, fires once (crown() is idempotent).
    // Wrapped so a broadcast failure can never break crowning / resolution.
    try {
      const champRow = (await sql`select username from users where wallet_address = ${address}`) as { username: string }[];
      const champName = champRow[0]?.username ?? "A player";
      const bTitle = `${round} Champion crowned 🏆`;
      const bBody = `@${champName} topped the ${round} with ${count} correct picks — see where you ranked.`;
      const bRows = (await sql`
        insert into notifications (user_address, type, title, body, icon)
        select distinct p.user_address, 'round_champion', ${bTitle}, ${bBody}, '🏆'
        from picks p
        join fixtures f on f.id = p.fixture_id
        join users u on u.wallet_address = p.user_address
        where f.round = ${round} and p.resolved = true
          and p.user_address <> ${address}
          and coalesce(u.notification_prefs->>'round_champion', '') <> 'false'
        returning user_address
      `) as { user_address: string }[];
      await Promise.all(
        bRows.map((r) => sendPush(r.user_address, { title: bTitle, body: bBody, icon: "🏆", url: "/play" }))
      );
    } catch (err) {
      console.error(`[resolution] champion broadcast failed for ${round}:`, err);
    }
  }
}

// ─── The Streakr — overall tournament champion ────────────────────────────────

interface ChampionRow {
  user_address: string;
  username: string;
  points: number;
  personal_best: number;
  correct_count: number;
}

/**
 * Rank users by the champion metric, optionally scoped to one group.
 *
 * Order: points → personal best → correct picks → earliest to lock it in.
 * Points LEAD because they already fuse correctness × streak length (each correct
 * pick banks 10 × the streak position), so a long run outscores the same number
 * of scattered hits. The rest only break ties. `current_streak` is deliberately
 * NOT used — one wrong pick would erase a whole tournament.
 */
async function topByChampionMetric(groupId: string | null): Promise<ChampionRow | null> {
  const rows = (groupId
    ? await sql`
        select u.wallet_address as user_address, u.username, u.points, u.personal_best,
               count(*) filter (where p.correct)::int as correct_count
        from users u
        join group_members gm on gm.user_address = u.wallet_address and gm.group_id = ${groupId}
        join picks p on p.user_address = u.wallet_address and p.resolved = true
        group by u.wallet_address, u.username, u.points, u.personal_best
        having count(*) filter (where p.correct) > 0
        order by u.points desc, u.personal_best desc, correct_count desc,
                 max(p.resolved_at) filter (where p.correct) asc
        limit 1`
    : await sql`
        select u.wallet_address as user_address, u.username, u.points, u.personal_best,
               count(*) filter (where p.correct)::int as correct_count
        from users u
        join picks p on p.user_address = u.wallet_address and p.resolved = true
        group by u.wallet_address, u.username, u.points, u.personal_best
        having count(*) filter (where p.correct) > 0
        order by u.points desc, u.personal_best desc, correct_count desc,
                 max(p.resolved_at) filter (where p.correct) asc
        limit 1`) as ChampionRow[];
  return rows[0] ?? null;
}

/**
 * Crown the overall champion once the Final is settled — globally AND once per
 * group, so every squad gets its own Streakr. Idempotent via the
 * round_champions unique index on (round, scope): safe to re-run every sync.
 */
async function crownTournamentChampion() {
  const [tally] = (await sql`
    select count(*)::int as total,
           count(*) filter (where status = 'finished')::int as done
    from fixtures where round = 'Final'
  `) as { total: number; done: number }[];
  if (!tally || tally.total === 0 || tally.done < tally.total) return; // Final not settled

  const global = await topByChampionMetric(null);
  if (global) await crownTournament(null, global, "the world");

  const groups = (await sql`select id, name from groups`) as { id: string; name: string }[];
  for (const g of groups) {
    const champ = await topByChampionMetric(g.id);
    if (champ) await crownTournament(g.id, champ, g.name);
  }
}

/** Record + announce one tournament crown (global when groupId is null). */
async function crownTournament(groupId: string | null, champ: ChampionRow, scopeLabel: string) {
  const res = (await sql`
    insert into round_champions (round, group_id, user_address, correct_count, points)
    values (${TOURNAMENT_ROUND}, ${groupId}, ${champ.user_address}, ${champ.correct_count}, ${champ.points})
    on conflict do nothing returning id
  `) as { id: string }[];
  if (!res.length) return; // already crowned for this scope

  if (groupId) {
    // Group crown — every squad gets its own champion.
    await grantBadge(champ.user_address, "b12"); // Group Champion
    await createNotification(champ.user_address, "round_champion",
      "Your squad's Streakr 🥇",
      `You topped ${scopeLabel} — ${champ.points} points, a ${champ.personal_best}-match best streak.`, "🥇");
    await sql`
      insert into group_activity_events (group_id, actor_address, type, message)
      values (${groupId}, ${champ.user_address}, 'win',
              ${`was crowned your group's Streakr with ${champ.points} points! 🥇`})
    `;
    return;
  }

  // The global crown — the ultimate badge, a personal moment, and a broadcast.
  await grantBadge(champ.user_address, "b17"); // The Streakr
  await createNotification(champ.user_address, "round_champion",
    "👑 You are THE STREAKR",
    `Champion of the whole tournament — ${champ.points} points, a ${champ.personal_best}-match best streak, ${champ.correct_count} correct picks. Take a bow.`,
    "👑");
  await emitGroupEvent(champ.user_address, "win",
    `was crowned THE STREAKR — champion of the tournament with ${champ.points} points! 👑`);

  // Tell everyone who played. Prefs-respected; wrapped so a broadcast failure
  // can never undo the crown.
  try {
    const bTitle = "👑 THE STREAKR crowned";
    const bBody = `@${champ.username} is champion of the tournament — ${champ.points} points and a ${champ.personal_best}-match streak. See the final standings.`;
    const bRows = (await sql`
      insert into notifications (user_address, type, title, body, icon)
      select distinct p.user_address, 'round_champion', ${bTitle}, ${bBody}, '👑'
      from picks p
      join users u on u.wallet_address = p.user_address
      where p.resolved = true
        and p.user_address <> ${champ.user_address}
        and coalesce(u.notification_prefs->>'round_champion', '') <> 'false'
      returning user_address
    `) as { user_address: string }[];
    await Promise.all(
      bRows.map((r) => sendPush(r.user_address, { title: bTitle, body: bBody, icon: "👑", url: "/play" }))
    );
  } catch (err) {
    console.error("[resolution] Streakr broadcast failed:", err);
  }
}
