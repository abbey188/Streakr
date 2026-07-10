import "dotenv/config";
import { txlineClient } from "@/lib/txline/client";
import { buildRoundMap } from "@/lib/txline/normalize";

/** Read-only: what rounds does TxLINE publish right now? Answers whether the
 *  Semi-final / Final will ever sync in — the crown can't fire without them. */
const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
const START_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

async function main() {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, START_DAY);
  console.log("fixtures upstream:", raw.length);

  const roundByGroup = buildRoundMap(raw);
  const counts = new Map<string, { n: number; first: number }>();
  for (const f of raw) {
    const round = roundByGroup.get(f.FixtureGroupId) ?? "(unmapped)";
    const c = counts.get(round) ?? { n: 0, first: Infinity };
    c.n++; c.first = Math.min(c.first, f.StartTime);
    counts.set(round, c);
  }
  console.log("\nrounds as OUR code would label them:");
  for (const [round, c] of [...counts].sort((a, b) => a[1].first - b[1].first)) {
    console.log(`  ${round.padEnd(16)} ${String(c.n).padStart(3)} matches   first ${new Date(c.first).toISOString().slice(0, 16)}`);
  }
  const missing = ["Semifinals", "Final"].filter((r) => !counts.has(r));
  console.log("\nmissing upstream:", missing.length ? missing.join(", ") : "none — SF + Final are published");
}
main().catch((e) => { console.error(e); process.exit(1); });
