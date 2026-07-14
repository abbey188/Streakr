import "dotenv/config";
import { txlineClient } from "@/lib/txline/client";
import { buildRoundMap, deriveMatchEvents } from "@/lib/txline/normalize";
import { upsertMatchEvents } from "@/lib/db/queries";
import { sql } from "@/lib/db/client";

/** Integration test for the new match_events upsert path against a REAL finished
 *  fixture that already exists in the fixtures table (so the FK holds). Runs the
 *  upsert TWICE to prove idempotency (row count must not change), then reads back. */
const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
const START_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

async function main() {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, START_DAY);
  const roundByGroup = buildRoundMap(raw);
  const now = Date.now();
  const started = raw
    .filter((f) => roundByGroup.get(f.FixtureGroupId) !== "Group Stage" && Number(f.StartTime) < now)
    .sort((a, b) => Number(b.StartTime) - Number(a.StartTime));

  // Pick the most recent one that actually exists in our fixtures table (FK).
  let target: string | null = null;
  for (const f of started) {
    const rows = (await sql`select id from fixtures where id = ${String(f.FixtureId)}`) as { id: string }[];
    if (rows.length) { target = String(f.FixtureId); break; }
  }
  if (!target) { console.log("No started knockout fixture found in fixtures table — skipping."); return; }

  const updates = await txlineClient.getScoresUpdates(target, 6000);
  const events = deriveMatchEvents(updates);
  console.log(`fixture ${target}: derived ${events.length} events`);

  const rows = events.map((ev) => ({ fixtureId: target!, ev }));
  await upsertMatchEvents(rows);
  const c1 = (await sql`select count(*)::int as n from match_events where fixture_id = ${target}`) as { n: number }[];
  await upsertMatchEvents(rows); // second run — must NOT add rows
  const c2 = (await sql`select count(*)::int as n from match_events where fixture_id = ${target}`) as { n: number }[];

  console.log(`persisted: ${c1[0].n}  after re-run: ${c2[0].n}  ${c1[0].n === c2[0].n && c1[0].n === events.length ? "✓ idempotent" : "✗ PROBLEM"}`);

  const sample = (await sql`
    select type, minute, payload from match_events
    where fixture_id = ${target} order by minute, seq limit 8
  `) as { type: string; minute: number; payload: unknown }[];
  console.log("read-back sample:");
  for (const r of sample) console.log(`  ${String(r.minute).padStart(3)}'  ${r.type.padEnd(8)} ${JSON.stringify(r.payload)}`);

  // Clean up so the table stays empty until the live cron populates it naturally.
  await sql`delete from match_events where fixture_id = ${target}`;
  console.log("cleaned up test rows ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
