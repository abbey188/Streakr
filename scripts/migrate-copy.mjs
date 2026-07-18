// One-shot migration: rebuild the schema on a NEW Neon project and copy every
// row from the current DB into it. Same HTTP driver the app uses, so it works
// through the local TLS proxy without pg_dump/psql.
//
//   DATABASE_URL      = SOURCE  (current project, still serving)
//   NEW_DATABASE_URL  = DEST    (fresh project — its own 100 CU-hr allowance)
//
// Run:  unset NODE_OPTIONS; node --env-file=.env scripts/migrate-copy.mjs
// Safe to re-run: schema is `if not exists`, inserts are `on conflict do nothing`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_URL = process.env.DATABASE_URL;
const DST_URL = process.env.NEW_DATABASE_URL;

if (!SRC_URL) { console.error("DATABASE_URL (source) not set."); process.exit(1); }
if (!DST_URL) { console.error("NEW_DATABASE_URL (destination) not set. Add it to .env."); process.exit(1); }
if (SRC_URL === DST_URL) { console.error("SOURCE and DEST are identical — aborting."); process.exit(1); }

const src = neon(SRC_URL);
const dst = neon(DST_URL);

// The 0.10.x HTTP driver is tagged-template only. Wrap a plain string as a
// zero-parameter template so we can run arbitrary SQL text.
const rawTag = (s) => Object.assign([s], { raw: [s] });
const run = (client, text) => client(rawTag(text)); // no params → returns rows[]

// Tables in FK-dependency order (parents before children). Mirrors schema.sql.
const TABLES = [
  "teams", "users", "fixtures", "picks",
  "groups", "group_members", "group_activity_events", "group_messages", "group_reactions",
  "badges", "user_badges", "notifications", "round_champions", "announcements",
  "match_events", "push_subscriptions",
];

const isJsonbObject = (v) => v !== null && typeof v === "object" && !(v instanceof Date);

async function applySchema() {
  const raw = readFileSync(join(__dirname, "..", "lib", "db", "schema.sql"), "utf8");
  const statements = raw
    .split("\n").map((l) => { const i = l.indexOf("--"); return i >= 0 ? l.slice(0, i) : l; }).join("\n")
    .split(";").map((s) => s.trim()).filter(Boolean);
  console.log(`Applying schema to destination (${statements.length} statements)…`);
  for (const stmt of statements) await run(dst, stmt);
  console.log("✓ Schema ready on destination.\n");
}

async function copyTable(t) {
  const rows = await run(src, `select * from ${t}`);
  if (rows.length === 0) { console.log(`  ${t.padEnd(24)} 0 rows`); return; }
  const cols = Object.keys(rows[0]);
  const quotedCols = cols.map((c) => `"${c}"`).join(", ");

  for (const row of rows) {
    // Build a tagged-template call: value i is followed by an optional ::jsonb
    // cast, then a separator or the closing clause. This mirrors how
    //   sql`insert … values (${v0}::jsonb, ${v1}) on conflict do nothing`
    // desugars, so parameters stay bound (no string interpolation of data).
    const strings = [`insert into ${t} (${quotedCols}) values (`];
    const params = [];
    cols.forEach((c, i) => {
      const v = row[c];
      const jsonb = isJsonbObject(v);
      params.push(v instanceof Date ? v.toISOString() : jsonb ? JSON.stringify(v) : v);
      const cast = jsonb ? "::jsonb" : "";
      strings.push(`${cast}${i === cols.length - 1 ? ") on conflict do nothing" : ", "}`);
    });
    await dst(Object.assign([...strings], { raw: [...strings] }), ...params);
  }
  console.log(`  ${t.padEnd(24)} ${rows.length} rows`);
}

async function verify() {
  console.log("\nVerifying row counts (source → dest):");
  let mismatch = false;
  for (const t of TABLES) {
    const [s] = await run(src, `select count(*)::int as n from ${t}`);
    const [d] = await run(dst, `select count(*)::int as n from ${t}`);
    if (s.n !== d.n) mismatch = true;
    console.log(`  ${t.padEnd(24)} ${String(s.n).padStart(5)} → ${String(d.n).padStart(5)}  ${s.n === d.n ? "✓" : "✗ MISMATCH"}`);
  }
  return !mismatch;
}

(async () => {
  console.log("── Neon project migration ──\n");
  await applySchema();
  console.log("Copying data:");
  for (const t of TABLES) await copyTable(t);
  const clean = await verify();
  console.log(clean ? "\n✓ Migration complete — all counts match." : "\n✗ Some counts differ — review above before switching DATABASE_URL.");
  process.exit(clean ? 0 : 1);
})().catch((e) => { console.error("\nMigration failed:", e); process.exit(1); });
