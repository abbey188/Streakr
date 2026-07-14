import "dotenv/config";
import { txlineClient } from "@/lib/txline/client";
import { buildRoundMap, deriveMatchEvents, deriveGoals } from "@/lib/txline/normalize";

/** Sanity-check deriveMatchEvents against a real finished knockout fixture:
 *  are the moments sane, named, and deduped (no phantom / double goals)? */
const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
const START_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

async function main() {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, START_DAY);
  const roundByGroup = buildRoundMap(raw);
  const now = Date.now();
  const started = raw
    .filter((f) => roundByGroup.get(f.FixtureGroupId) !== "Group Stage" && Number(f.StartTime) < now)
    .sort((a, b) => Number(b.StartTime) - Number(a.StartTime))
    .slice(0, 2);

  for (const f of started) {
    const updates = await txlineClient.getScoresUpdates(f.FixtureId, 6000);
    const events = deriveMatchEvents(updates);
    const goals = deriveGoals(updates);
    console.log(`\n═══ ${f.Participant1} v ${f.Participant2}  [${roundByGroup.get(f.FixtureGroupId)}] ═══`);
    console.log(`updates=${updates.length}  events=${events.length}  goals(deriveGoals)=${goals.length}`);
    const goalRows = events.filter((e) => e.type === "goal" || e.type === "penalty");
    console.log(`feed goals=${goalRows.length}  (must equal deriveGoals=${goals.length})  ${goalRows.length === goals.length ? "✓" : "✗ MISMATCH"}`);
    const byType = new Map<string, number>();
    for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    console.log("by type:", [...byType].map(([t, n]) => `${t}=${n}`).join("  "));
    // dedup check: no two events share the same key
    const keys = new Set(events.map((e) => e.key));
    console.log(`unique keys: ${keys.size}/${events.length}  ${keys.size === events.length ? "✓" : "✗ DUPLICATE KEY"}`);
    console.log("sample (chronological):");
    for (const e of events.slice(0, 14)) {
      console.log(`  ${String(e.minute).padStart(3)}'  ${e.type.padEnd(8)} ${JSON.stringify(e.payload)}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
