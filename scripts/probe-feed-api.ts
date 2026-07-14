import "dotenv/config";
import { txlineClient } from "@/lib/txline/client";
import { buildRoundMap, deriveMatchEvents } from "@/lib/txline/normalize";
import { upsertMatchEvents, getFeed } from "@/lib/db/queries";
import { sql } from "@/lib/db/client";

/** End-to-end test of getFeed(): seed real events for a finished knockout
 *  fixture, read the feed back with full match context, then clean up. */
const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
const START_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

async function main() {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, START_DAY);
  const roundByGroup = buildRoundMap(raw);
  const now = Date.now();
  const started = raw
    .filter((f) => roundByGroup.get(f.FixtureGroupId) !== "Group Stage" && Number(f.StartTime) < now)
    .sort((a, b) => Number(b.StartTime) - Number(a.StartTime));

  const target: string[] = [];
  for (const f of started) {
    const exist = (await sql`select id from fixtures where id = ${String(f.FixtureId)}`) as { id: string }[];
    if (exist.length) { target.push(String(f.FixtureId)); if (target.length === 2) break; }
  }
  if (!target.length) { console.log("no fixtures in table — skip"); return; }

  for (const id of target) {
    const updates = await txlineClient.getScoresUpdates(id, 6000);
    await upsertMatchEvents(deriveMatchEvents(updates).map((ev) => ({ fixtureId: id, ev })));
  }

  const feed = await getFeed(20);
  console.log(`getFeed → ${feed.length} items (from ${target.length} fixtures)\n`);
  for (const it of feed.slice(0, 12)) {
    const m = it.match;
    const p = it.payload as { side?: string; scorer?: string; player?: string; on?: string; off?: string; outcome?: string };
    const who = p.scorer || p.player || (p.on ? `${p.on} on` : "") || p.outcome || "";
    const sideFlag = p.side === "A" ? m.teamA.flag : p.side === "B" ? m.teamB.flag : "";
    console.log(
      `  ${String(it.minute ?? "").padStart(3)}'  ${it.type.padEnd(8)} ` +
      `${m.teamA.flag}${m.teamA.code} ${m.scoreA ?? 0}-${m.scoreB ?? 0} ${m.teamB.code}${m.teamB.flag} ` +
      `[${m.status}]  ${sideFlag}${who}`
    );
  }

  // cleanup
  for (const id of target) await sql`delete from match_events where fixture_id = ${id}`;
  console.log("\ncleaned up ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
