// Seed the Neon DB with the prototype's demo data so the API returns the
// same familiar content the mock fixtures showed.
// Run: node --env-file=.env.local scripts/seed.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run: node --env-file=.env.local scripts/seed.mjs");
  process.exit(1);
}
const sql = neon(url);

const TEAMS = {
  BRA: { id: "bra", name: "Brazil", flag: "🇧🇷", code: "BRA" },
  FRA: { id: "fra", name: "France", flag: "🇫🇷", code: "FRA" },
  ARG: { id: "arg", name: "Argentina", flag: "🇦🇷", code: "ARG" },
  ENG: { id: "eng", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", code: "ENG" },
  ESP: { id: "esp", name: "Spain", flag: "🇪🇸", code: "ESP" },
  GER: { id: "ger", name: "Germany", flag: "🇩🇪", code: "GER" },
  NED: { id: "ned", name: "Netherlands", flag: "🇳🇱", code: "NED" },
  USA: { id: "usa", name: "United States", flag: "🇺🇸", code: "USA" },
  MEX: { id: "mex", name: "Mexico", flag: "🇲🇽", code: "MEX" },
  JPN: { id: "jpn", name: "Japan", flag: "🇯🇵", code: "JPN" },
  MAR: { id: "mar", name: "Morocco", flag: "🇲🇦", code: "MAR" },
  POR: { id: "por", name: "Portugal", flag: "🇵🇹", code: "POR" },
};

const FIXTURES = [
  { id: "m1", round: "Round of 16", a: "fra", b: "esp", status: "live", sa: 2, sb: 1, minute: 78, ko: "17:00", win: null },
  { id: "m2", round: "Round of 16", a: "bra", b: "arg", status: "upcoming", sa: null, sb: null, minute: null, ko: "20:00", win: null },
  { id: "m3", round: "Round of 16", a: "ned", b: "usa", status: "upcoming", sa: null, sb: null, minute: null, ko: "Tomorrow, 15:00", win: null },
  { id: "m4", round: "Round of 16", a: "jpn", b: "mex", status: "upcoming", sa: null, sb: null, minute: null, ko: "Tomorrow, 19:00", win: null },
  { id: "m5", round: "Round of 16", a: "eng", b: "ger", status: "finished", sa: 3, sb: 2, minute: null, ko: "Yesterday", win: "A" },
  { id: "m6", round: "Round of 16", a: "por", b: "mar", status: "finished", sa: 0, sb: 1, minute: null, ko: "Yesterday", win: "B" },
];

const BADGES = [
  { id: "b1", name: "First Blood", icon: "🎯", description: "Made your very first correct knockout pick.", color: "from-amber-400 to-orange-500" },
  { id: "b2", name: "Hat-Trick Hero", icon: "⚡", description: "Reached a 3-match active pick streak.", color: "from-yellow-400 to-amber-500" },
  { id: "b3", name: "On Fire", icon: "🔥", description: "Reached a 5-match active pick streak.", color: "from-orange-500 to-red-600" },
  { id: "b4", name: "World Class", icon: "👑", description: "Reached a 10-match active pick streak.", color: "from-purple-500 to-indigo-600" },
  { id: "b5", name: "Unstoppable", icon: "🚀", description: "Reached a 15-match active pick streak.", color: "from-sky-400 to-blue-600" },
  { id: "b6", name: "GOAT", icon: "🐐", description: "Reached a legendary 20-match active pick streak.", color: "from-fuchsia-500 to-purple-700" },
  { id: "b7", name: "Rising Star", icon: "🌟", description: "Banked 500 lifetime points.", color: "from-amber-300 to-yellow-500" },
  { id: "b8", name: "Elite Streakr", icon: "💎", description: "Banked 1,500 lifetime points.", color: "from-cyan-400 to-indigo-600" },
  { id: "b9", name: "Oracle", icon: "🔮", description: "Banked 3,000 lifetime points.", color: "from-emerald-400 to-teal-600" },
  { id: "b10", name: "Squad Up", icon: "🛡️", description: "Created or joined your first group.", color: "from-slate-400 to-slate-600" },
  { id: "b11", name: "Recruiter", icon: "📣", description: "A friend joined a group with your invite code.", color: "from-pink-400 to-rose-600" },
  { id: "b12", name: "Group Champion", icon: "🥇", description: "Finished #1 in one of your groups.", color: "from-amber-400 to-yellow-600" },
];

// Demo users (the leaderboard members). Synthetic wallet addresses for seed.
const USERS = [
  { addr: "demo-streakking07", username: "StreakKing07", streak: 11, avatar: { skinTone: "#FCD34D", kitPrimary: "#EF4444", kitSecondary: "#FFFFFF", expression: "cool", username: "StreakKing07" } },
  { addr: "demo-fulltime42", username: "FullTime42", streak: 8, avatar: { skinTone: "#D97706", kitPrimary: "#2563EB", kitSecondary: "#FACC15", expression: "hyped", username: "FullTime42" } },
  { addr: "demo-chidigoal", username: "Chidi_Goal", streak: 6, avatar: { skinTone: "#451A03", kitPrimary: "#10B981", kitSecondary: "#FFFFFF", expression: "wink", username: "Chidi_Goal" } },
  { addr: "demo-sarahkicks", username: "SarahKicks", streak: 4, avatar: { skinTone: "#FEE2E2", kitPrimary: "#84CC16", kitSecondary: "#A855F7", expression: "happy", username: "SarahKicks" } },
  { addr: "demo-goaldigger", username: "GoalDigger", streak: 3, avatar: { skinTone: "#FFEDD5", kitPrimary: "#F97316", kitSecondary: "#1E293B", expression: "cheeky", username: "GoalDigger" } },
];

const GROUP_ID = "11111111-1111-1111-1111-111111111111";

const ACTIVITY = [
  { actor: "demo-chidigoal", type: "milestone", message: "just hit an epic 5-match pick streak! 🚀", ageMin: 10, reactions: { "🔥": 8, "👏": 12, "😂": 1 } },
  { actor: "demo-sarahkicks", type: "break", message: "lost their 4-streak on Portugal's shocking loss to Morocco. F in chat!", ageMin: 60, reactions: { "💀": 14, "😢": 5, "😂": 9 } },
  { actor: "demo-fulltime42", type: "badge", message: "unlocked the 'On Fire' badge for picking 5 correct knockout outcomes in a row!", ageMin: 180, reactions: { "👑": 10, "👏": 14, "🔥": 19 } },
  { actor: "demo-streakking07", type: "win", message: "crowned Chapter Champion for the Round of 32! 🏆", ageMin: 1440, reactions: { "🏆": 25, "👏": 18, "👑": 12 } },
];

async function main() {
  // Teams
  for (const t of Object.values(TEAMS)) {
    await sql`insert into teams (id, name, flag, code) values (${t.id}, ${t.name}, ${t.flag}, ${t.code})
      on conflict (id) do update set name = excluded.name, flag = excluded.flag, code = excluded.code`;
  }
  console.log(`✓ ${Object.keys(TEAMS).length} teams`);

  // Fixtures
  for (const f of FIXTURES) {
    await sql`insert into fixtures (id, round, team_a_id, team_b_id, status, score_a, score_b, minute, kickoff_time, actual_winner)
      values (${f.id}, ${f.round}, ${f.a}, ${f.b}, ${f.status}, ${f.sa}, ${f.sb}, ${f.minute}, ${f.ko}, ${f.win})
      on conflict (id) do update set status = excluded.status, score_a = excluded.score_a, score_b = excluded.score_b,
        minute = excluded.minute, actual_winner = excluded.actual_winner, updated_at = now()`;
  }
  console.log(`✓ ${FIXTURES.length} fixtures`);

  // Badges
  for (const b of BADGES) {
    await sql`insert into badges (id, name, icon, description, color) values (${b.id}, ${b.name}, ${b.icon}, ${b.description}, ${b.color})
      on conflict (id) do update set name = excluded.name, icon = excluded.icon, description = excluded.description, color = excluded.color`;
  }
  console.log(`✓ ${BADGES.length} badges`);

  // Users
  for (const u of USERS) {
    await sql`insert into users (wallet_address, username, avatar, current_streak, personal_best, points)
      values (${u.addr}, ${u.username}, ${JSON.stringify(u.avatar)}, ${u.streak}, ${u.streak}, ${u.streak * 50})
      on conflict (wallet_address) do update set username = excluded.username, avatar = excluded.avatar,
        current_streak = excluded.current_streak, personal_best = excluded.personal_best`;
  }
  console.log(`✓ ${USERS.length} demo users`);

  // Group + members
  await sql`insert into groups (id, name, emoji, invite_code, created_by)
    values (${GROUP_ID}, ${"Local Legends WC"}, ${"🏆"}, ${"STREAK-99X"}, ${USERS[0].addr})
    on conflict (id) do nothing`;
  for (const u of USERS) {
    await sql`insert into group_members (group_id, user_address) values (${GROUP_ID}, ${u.addr})
      on conflict do nothing`;
  }
  console.log(`✓ group + ${USERS.length} members`);

  // Activity (clear then insert so re-seeding stays clean)
  await sql`delete from group_activity_events where group_id = ${GROUP_ID}`;
  for (const e of ACTIVITY) {
    await sql`insert into group_activity_events (group_id, actor_address, type, message, reactions, created_at)
      values (${GROUP_ID}, ${e.actor}, ${e.type}, ${e.message}, ${JSON.stringify(e.reactions)},
              now() - (${e.ageMin} || ' minutes')::interval)`;
  }
  console.log(`✓ ${ACTIVITY.length} activity events`);

  console.log("\n✓ Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
