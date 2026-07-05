// Repair a fixture that was WRONGLY marked finished + resolved (e.g. a feed
// glitch settled a live match — see docs/txline/FEED_LOG). Reverts it to a live
// status, un-resolves its picks, recomputes every affected user's streak/points,
// and clears the premature pick_result notifications.
//
// DRY RUN by default — shows what it would do. Add --apply to execute.
// Usage:
//   node --env-file=.env scripts/unresolve-fixture.mjs <fixtureId>            # preview
//   node --env-file=.env scripts/unresolve-fixture.mjs <fixtureId> --apply    # execute
//   ... --status=upcoming   (default: live)
//
// IMPORTANT: deploy the derivation fix FIRST, or the next sync re-finishes it.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set. Run with: node --env-file=.env scripts/unresolve-fixture.mjs <fixtureId>"); process.exit(1); }
const sql = neon(url);

const FX = process.argv[2];
if (!FX || FX.startsWith("--")) { console.error("Missing <fixtureId>."); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const status = (process.argv.find((a) => a.startsWith("--status=")) || "--status=live").split("=")[1];

const [fx] = await sql`
  select f.id, f.status, f.actual_winner, ta.name a, tb.name b
  from fixtures f join teams ta on ta.id=f.team_a_id join teams tb on tb.id=f.team_b_id
  where f.id=${FX}`;
if (!fx) { console.error(`Fixture ${FX} not found.`); process.exit(1); }
console.log(`Fixture ${FX}: ${fx.a} v ${fx.b} — status=${fx.status} winner=${fx.actual_winner ?? "-"}`);

const picks = await sql`select user_address, pick, resolved, correct from picks where fixture_id=${FX}`;
const users = [...new Set(picks.map((p) => p.user_address))];
console.log(`${picks.length} pick(s), ${users.length} user(s) affected.`);

// pick_result notifs carry no fixture_id → match by either team name, scoped to affected users.
const notifs = await sql`
  select id from notifications
  where type='pick_result' and user_address = any(${users})
    and (body like ${"%" + fx.a + "%"} or body like ${"%" + fx.b + "%"})`;
console.log(`${notifs.length} premature pick_result notification(s) to clear.`);

if (!APPLY) { console.log("\n(dry run — add --apply to execute)"); }
else {
  await sql`
    delete from notifications
    where type='pick_result' and user_address = any(${users})
      and (body like ${"%" + fx.a + "%"} or body like ${"%" + fx.b + "%"})`;
  await sql`update picks set resolved=false, correct=null, resolved_at=null where fixture_id=${FX}`;
  await sql`update fixtures set status=${status}, actual_winner=null, updated_at=now() where id=${FX}`;
  for (const addr of users) {
    const rows = await sql`
      select p.correct from picks p join fixtures f on f.id=p.fixture_id
      where p.user_address=${addr} and p.resolved=true
      order by f.kickoff_at asc nulls last, f.id asc`;
    let streak=0, best=0, points=0;
    for (const r of rows) { if (r.correct) { streak++; points += 10*streak; best=Math.max(best,streak); } else streak=0; }
    await sql`update users set current_streak=${streak}, personal_best=${best}, points=${points} where wallet_address=${addr}`;
    console.log(`  recomputed ${addr.slice(0,10)}… -> streak=${streak} best=${best} points=${points}`);
  }
  console.log(`\nDone. Reverted to '${status}'. Verify it stays live after the next sync.`);
}
