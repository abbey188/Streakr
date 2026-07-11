// Provision the Neon schema. Run: node --env-file=.env.local scripts/migrate.mjs
// Splits schema.sql into statements and runs each over the Neon HTTP driver.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/migrate.mjs");
  process.exit(1);
}

const sql = neon(url);
const raw = readFileSync(join(__dirname, "..", "lib", "db", "schema.sql"), "utf8");

// Strip every comment (full-line and inline), then split into statements.
// Safe here: no '--' appears inside any string literal in schema.sql.
const statements = raw
  .split("\n")
  .map((line) => {
    const i = line.indexOf("--");
    return i >= 0 ? line.slice(0, i) : line;
  })
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// 0.10.x http driver is template-tag only; wrap a raw string as a zero-param
// template so we can run DDL statements straight from schema.sql.
const runRaw = (stmt) => sql(Object.assign([stmt], { raw: [stmt] }));

// --reset drops all tables first (safe: dev/demo DB, schema.sql is source of truth).
if (process.argv.includes("--reset")) {
  const drops = [
    "user_badges", "badges", "group_reactions", "group_messages",
    "group_activity_reactions", "group_activity_events",
    "group_members", "groups", "picks", "fixtures", "users", "teams",
  ];
  console.log("Resetting: dropping existing tables...");
  for (const t of drops) {
    await runRaw(`drop table if exists ${t} cascade`);
  }
}

console.log(`Running ${statements.length} statements...`);
let n = 0;
for (const stmt of statements) {
  try {
    await runRaw(stmt);
    n++;
  } catch (err) {
    console.error(`\nFailed on statement #${n + 1}:\n${stmt}\n`, err);
    process.exit(1);
  }
}
console.log(`✓ Schema provisioned (${n} statements ran).`);
