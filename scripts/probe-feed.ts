import "dotenv/config";
import { txlineClient, type RawScoreEntry } from "@/lib/txline/client";
import { buildRoundMap } from "@/lib/txline/normalize";

/**
 * Read-only feed probe. Answers, from REAL TxLINE payloads, exactly what the
 * Live Feed can be built on:
 *   • which Action types the action log actually carries (goal/card/sub/var/…)
 *   • the Data keys per action (so we know what each moment can say)
 *   • whether venue / stadium / weather / referee / attendance appear ANYWHERE
 *   • StatusId phases seen (extra-time / penalties coverage)
 *   • possession + substitution presence for the momentum + sub moments
 * Nothing is written. Purely diagnostic.
 */
const COMPETITION_ID = Number(process.env.TXLINE_WORLD_CUP_COMPETITION_ID || 72);
const START_DAY = Math.floor(Date.parse("2026-06-14T00:00:00Z") / 86400000);

const RICH_KEY = /venue|stadium|weather|temperat|pitch|city|location|ground|arena|attendance|referee|official|country|climate|humid|wind/i;

/** Recursively collect every key path in an object + flag "rich metadata" keys. */
function scanKeys(obj: unknown, hits: Set<string>, path = "", seen = new Set<object>()) {
  if (obj == null || typeof obj !== "object") return;
  if (seen.has(obj as object)) return;
  seen.add(obj as object);
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (RICH_KEY.test(k)) hits.add(`${p} = ${JSON.stringify(v)?.slice(0, 60)}`);
    scanKeys(v, hits, p, seen);
  }
}

async function main() {
  const raw = await txlineClient.getFixturesSnapshot(COMPETITION_ID, START_DAY);
  const roundByGroup = buildRoundMap(raw);
  const now = Date.now();

  // ── 1. What does a raw FIXTURE object actually carry? (venue lives here if anywhere)
  const sample = raw.find((f) => roundByGroup.get(f.FixtureGroupId) !== "Group Stage") ?? raw[0];
  console.log("═══ RAW FIXTURE — all keys ═══");
  console.log(Object.keys(sample).sort().join(", "));
  const fxHits = new Set<string>();
  scanKeys(sample, fxHits);
  console.log("rich-metadata keys in fixture:", fxHits.size ? [...fxHits].join(" | ") : "NONE");

  // ── 2. Pick started knockout fixtures (richest logs: cards/subs/VAR/ET/pens)
  const started = raw
    .filter((f) => roundByGroup.get(f.FixtureGroupId) !== "Group Stage" && Number(f.StartTime) < now)
    .sort((a, b) => Number(b.StartTime) - Number(a.StartTime))
    .slice(0, 4);
  console.log(`\n═══ Probing ${started.length} recent knockout fixtures ═══`);

  const actionCounts = new Map<string, number>();
  const dataKeysByAction = new Map<string, Set<string>>();
  const statusIds = new Set<number>();
  const dataSampleByAction = new Map<string, string>();
  const scoreHits = new Set<string>();
  let sawLineups = false;

  const note = (e: RawScoreEntry) => {
    const a = e.Action || "(none)";
    actionCounts.set(a, (actionCounts.get(a) ?? 0) + 1);
    if (typeof e.StatusId === "number") statusIds.add(e.StatusId);
    if (e.Lineups) sawLineups = true;
    if (e.Data) {
      const set = dataKeysByAction.get(a) ?? new Set<string>();
      for (const k of Object.keys(e.Data)) set.add(k);
      dataKeysByAction.set(a, set);
      if (!dataSampleByAction.has(a)) dataSampleByAction.set(a, JSON.stringify(e.Data).slice(0, 140));
    }
  };

  for (const f of started) {
    const round = roundByGroup.get(f.FixtureGroupId);
    let updates: RawScoreEntry[] = [];
    try { updates = await txlineClient.getScoresUpdates(f.FixtureId, 6000); } catch { /* ignore */ }
    let snap: RawScoreEntry[] = [];
    try { snap = await txlineClient.getScoresSnapshot(f.FixtureId); } catch { /* ignore */ }
    console.log(
      `  ${f.Participant1} v ${f.Participant2}  [${round}]  ` +
      `updates=${updates.length} snapshot=${snap.length}  ${new Date(Number(f.StartTime)).toISOString().slice(0, 16)}`
    );
    for (const e of updates) note(e);
    for (const e of snap) { note(e); scanKeys(e.Score, scoreHits); scanKeys(e.Data, scoreHits); }
  }

  // ── 3. Report
  console.log("\n═══ ACTION TYPES seen (count) ═══");
  for (const [a, n] of [...actionCounts].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${a.padEnd(22)} ${String(n).padStart(5)}   data: ${[...(dataKeysByAction.get(a) ?? [])].join(", ") || "—"}`);
  }

  console.log("\n═══ DATA SAMPLES (first seen per action) ═══");
  for (const a of ["goal", "penalty", "penalty_outcome", "yellow_card", "red_card", "substitution", "injury", "var", "var_end", "shot", "venue", "weather", "pitch", "additional_time", "possible", "status", "kickoff_team"]) {
    if (dataSampleByAction.has(a)) console.log(`  ${a}: ${dataSampleByAction.get(a)}`);
  }

  console.log("\n═══ StatusId phases seen ═══");
  console.log("  " + [...statusIds].sort((a, b) => a - b).join(", ") + "   (6-10 = extra time, 11-13 = penalties)");

  console.log("\n═══ Feed capability check ═══");
  const has = (a: string) => (actionCounts.get(a) ?? 0) > 0;
  console.log(`  goals ............ ${has("goal") || has("penalty_outcome") ? "YES" : "no"}`);
  console.log(`  yellow/red ....... ${has("yellow_card") || has("red_card") ? "YES" : "no"}`);
  console.log(`  substitutions .... ${has("substitution") ? "YES" : "NO — sub moment not available"}`);
  console.log(`  VAR .............. ${has("var") || has("var_end") ? "YES" : "no"}`);
  console.log(`  shots ............ ${has("shot") ? "YES" : "no"}`);
  const possessionActions = [...actionCounts.keys()].filter((a) => /possession/.test(a));
  console.log(`  possession ....... ${possessionActions.length ? "YES — " + possessionActions.join(", ") : "NO"}`);
  console.log(`  lineups .......... ${sawLineups ? "YES" : "no"}`);
  console.log(`  extra time ....... ${[...statusIds].some((s) => s >= 6 && s <= 10) ? "YES (phase seen)" : "not in sample"}`);
  console.log(`  penalties ........ ${[...statusIds].some((s) => s >= 11 && s <= 13) ? "YES (phase seen)" : "not in sample"}`);
  console.log(`  venue/weather .... ${fxHits.size || scoreHits.size ? [...fxHits, ...scoreHits].join(" | ") : "NONE found in any payload"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
