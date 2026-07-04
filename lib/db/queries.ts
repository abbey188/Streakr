import { sql } from "./client";
import type {
  AvatarConfig,
  Team,
  Fixture,
  Badge,
  GroupMember,
  ActivityItem,
  Notification,
} from "../../src/types";
import type { FormEntry } from "@/lib/txline/types";
import { prefAllows } from "./notify-prefs";

/**
 * Typed data-access layer.
 *
 * Every function returns the EXACT shapes from src/types.ts so the migrated
 * frontend components need no prop changes (handoff §4). Row→type mapping is
 * the only job here; no business logic leaks into components.
 */

// ─── Users ──────────────────────────────────────────────────────────────

export interface UserState {
  walletAddress: string;
  username: string;
  email: string | null;
  avatar: AvatarConfig;
  points: number;
  currentStreak: number;
  personalBest: number;
}

interface UserRow {
  wallet_address: string;
  username: string;
  email: string | null;
  avatar: AvatarConfig;
  points: number;
  current_streak: number;
  personal_best: number;
}

function mapUser(r: UserRow): UserState {
  return {
    walletAddress: r.wallet_address,
    username: r.username,
    email: r.email,
    avatar: r.avatar,
    points: r.points,
    currentStreak: r.current_streak,
    personalBest: r.personal_best,
  };
}

/** Returning-user lookup by wallet identity. null = first-time user (show tour). */
export async function getUserByWallet(
  walletAddress: string
): Promise<UserState | null> {
  const rows = (await sql`
    select wallet_address, username, email, avatar, points, current_streak, personal_best
    from users
    where wallet_address = ${walletAddress}
  `) as UserRow[];
  if (rows.length === 0) return null;
  // Touch last_seen for session/analytics; fire-and-forget is fine but we await
  // to keep Neon's HTTP driver from cancelling the request on serverless return.
  await sql`update users set last_seen_at = now() where wallet_address = ${walletAddress}`;
  return mapUser(rows[0]);
}

/** Create a new user at signup (avatar = chosen mascot). Idempotent on wallet. */
export async function createUser(input: {
  walletAddress: string;
  username: string;
  email?: string | null;
  avatar: AvatarConfig;
}): Promise<UserState> {
  const rows = (await sql`
    insert into users (wallet_address, username, email, avatar)
    values (${input.walletAddress}, ${input.username}, ${input.email ?? null}, ${JSON.stringify(input.avatar)})
    on conflict (wallet_address) do update
      set username = excluded.username,
          email = coalesce(excluded.email, users.email),
          avatar = excluded.avatar,
          last_seen_at = now()
    returning wallet_address, username, email, avatar, points, current_streak, personal_best
  `) as UserRow[];
  return mapUser(rows[0]);
}

/** Update the mascot/avatar (and username) from the profile editor. */
export async function updateUserAvatar(
  walletAddress: string,
  avatar: AvatarConfig
): Promise<UserState> {
  const rows = (await sql`
    update users
      set avatar = ${JSON.stringify(avatar)}, username = ${avatar.username}
      where wallet_address = ${walletAddress}
    returning wallet_address, username, email, avatar, points, current_streak, personal_best
  `) as UserRow[];
  return mapUser(rows[0]);
}

// ─── Fixtures ───────────────────────────────────────────────────────────

interface FixtureRow {
  id: string;
  round: string;
  status: Fixture["status"];
  score_a: number | null;
  score_b: number | null;
  minute: number | null;
  kickoff_time: string;
  actual_winner: "A" | "B" | null;
  team_a_id: string;
  team_a_name: string;
  team_a_flag: string;
  team_a_code: string;
  team_b_id: string;
  team_b_name: string;
  team_b_flag: string;
  team_b_code: string;
  kickoff_at: string | null;
  updated_at: string | null;
  user_pick: "A" | "B" | null;
}

function mapFixture(r: FixtureRow): Fixture {
  const teamA: Team = { id: r.team_a_id, name: r.team_a_name, flag: r.team_a_flag, code: r.team_a_code };
  const teamB: Team = { id: r.team_b_id, name: r.team_b_name, flag: r.team_b_flag, code: r.team_b_code };
  return {
    id: r.id,
    round: r.round,
    teamA,
    teamB,
    status: r.status,
    scoreA: r.score_a ?? undefined,
    scoreB: r.score_b ?? undefined,
    minute: r.minute ?? undefined,
    kickoffTime: r.kickoff_time,
    kickoffAt: r.kickoff_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    userPick: r.user_pick ?? undefined,
    actualWinner: r.actual_winner ?? undefined,
  };
}

/**
 * All fixtures, joined with team details and (optionally) the given user's
 * pick. Pass walletAddress to hydrate userPick per-fixture; omit for a
 * logged-out/public view.
 */
export async function getFixtures(walletAddress?: string): Promise<Fixture[]> {
  const rows = (await sql`
    select
      f.id, f.round, f.status, f.score_a, f.score_b, f.minute,
      f.kickoff_time, f.kickoff_at, f.updated_at, f.actual_winner,
      ta.id as team_a_id, ta.name as team_a_name, ta.flag as team_a_flag, ta.code as team_a_code,
      tb.id as team_b_id, tb.name as team_b_name, tb.flag as team_b_flag, tb.code as team_b_code,
      p.pick as user_pick
    from fixtures f
    join teams ta on ta.id = f.team_a_id
    join teams tb on tb.id = f.team_b_id
    left join picks p
      on p.fixture_id = f.id
     and p.user_address = ${walletAddress ?? null}
    where f.round <> 'Group Stage'
    order by f.kickoff_at nulls last, f.id
  `) as FixtureRow[];
  return rows.map(mapFixture);
}

// ─── Team form (last-5 W/D/L across the tournament) ──────────────────────────

interface FormRow {
  team_a_id: string;
  team_b_id: string;
  score_a: number | null;
  score_b: number | null;
  actual_winner: "A" | "B" | null;
  team_a_code: string;
  team_b_code: string;
}

/** A team's last 5 finished results (any round), most recent first. */
export async function getTeamForm(teamId: string): Promise<FormEntry[]> {
  const rows = (await sql`
    select f.team_a_id, f.team_b_id, f.score_a, f.score_b, f.actual_winner,
           ta.code as team_a_code, tb.code as team_b_code
    from fixtures f
    join teams ta on ta.id = f.team_a_id
    join teams tb on tb.id = f.team_b_id
    where (f.team_a_id = ${teamId} or f.team_b_id = ${teamId})
      and f.status = 'finished'
    order by f.kickoff_at desc nulls last
    limit 5
  `) as FormRow[];

  return rows.map((r) => {
    const isA = r.team_a_id === teamId;
    const scoreFor = (isA ? r.score_a : r.score_b) ?? 0;
    const scoreAgainst = (isA ? r.score_b : r.score_a) ?? 0;
    const mySide = isA ? "A" : "B";
    let result: "W" | "D" | "L";
    if (scoreFor > scoreAgainst) result = "W";
    else if (scoreFor < scoreAgainst) result = "L";
    else result = r.actual_winner ? (r.actual_winner === mySide ? "W" : "L") : "D";
    return { result, scoreFor, scoreAgainst, opponentCode: isA ? r.team_b_code : r.team_a_code };
  });
}

// ─── Picks ──────────────────────────────────────────────────────────────

/**
 * Lock (or change) a user's pick for a fixture. Only allowed while the
 * fixture is still 'upcoming' — once live/finished the pick is frozen so a
 * streak can't be gamed after kickoff. Returns false if the pick was rejected.
 */
export async function makePick(
  walletAddress: string,
  fixtureId: string,
  pick: "A" | "B"
): Promise<boolean> {
  const guard = (await sql`
    select status, kickoff_at from fixtures where id = ${fixtureId}
  `) as { status: Fixture["status"]; kickoff_at: string | null }[];
  if (guard.length === 0) return false;
  // Freeze picks by STATUS *and* by TIME. The time check is defence-in-depth:
  // even if a data glitch left a kicked-off match marked 'upcoming', we still
  // refuse the pick, so a played match can never be gamed.
  const kickedOff = guard[0].kickoff_at ? Date.parse(guard[0].kickoff_at) <= Date.now() : false;
  if (guard[0].status !== "upcoming" || kickedOff) return false;

  await sql`
    insert into picks (user_address, fixture_id, pick)
    values (${walletAddress}, ${fixtureId}, ${pick})
    on conflict (user_address, fixture_id) do update
      set pick = excluded.pick, created_at = now()
  `;
  return true;
}

// ─── Badges ─────────────────────────────────────────────────────────────

interface BadgeRow {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export async function getBadges(): Promise<Badge[]> {
  const rows = (await sql`
    select id, name, icon, description, color from badges order by id
  `) as BadgeRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    color: r.color,
  }));
}

// ─── Leaderboard (group-scoped) ─────────────────────────────────────────

interface LeaderboardRow {
  user_address: string;
  username: string;
  avatar: AvatarConfig;
  current_streak: number;
}

/**
 * Group leaderboard ranked by current streak. `change` (up/down/same) needs
 * historical rank snapshots we don't store yet, so it defaults to "same" —
 * a later pass adds rank history without changing this shape.
 */
export async function getGroupLeaderboard(
  groupId: string,
  currentUserAddress?: string
): Promise<GlobalLeaderboardEntry[]> {
  const rows = (await sql`
    select u.wallet_address as user_address, u.username, u.avatar, u.current_streak, u.points
    from group_members gm
    join users u on u.wallet_address = gm.user_address
    where gm.group_id = ${groupId}
    order by u.current_streak desc, u.points desc, u.username asc
  `) as GlobalRow[];
  return rows.map((r, i) => ({
    id: r.user_address,
    rank: i + 1,
    username: r.username,
    avatar: r.avatar,
    streak: r.current_streak,
    points: r.points,
    change: "same" as const,
    isCurrentUser: r.user_address === currentUserAddress,
  }));
}

/** Global leaderboard entry — GroupMember plus points (the Play widget sorts by both). */
export type GlobalLeaderboardEntry = GroupMember & { points: number };

interface GlobalRow {
  user_address: string;
  username: string;
  avatar: AvatarConfig;
  current_streak: number;
  points: number;
}

/**
 * Global leaderboard — every signed-up user ranked by streak (then points). No
 * group membership required (everyone is implicitly on it).
 */
export async function getGlobalLeaderboard(
  currentUserAddress?: string
): Promise<GlobalLeaderboardEntry[]> {
  const rows = (await sql`
    select u.wallet_address as user_address, u.username, u.avatar, u.current_streak, u.points
    from users u
    order by u.current_streak desc, u.points desc, u.username asc
    limit 100
  `) as GlobalRow[];
  return rows.map((r, i) => ({
    id: r.user_address,
    rank: i + 1,
    username: r.username,
    avatar: r.avatar,
    streak: r.current_streak,
    points: r.points,
    change: "same" as const,
    isCurrentUser: r.user_address === currentUserAddress,
  }));
}

// ─── Friend groups (create / join / list) ─────────────────────────────────

export type LeaderboardType = "streak" | "points" | "both";

export interface GroupSummary {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
  leaderboardType: LeaderboardType;
}

interface GroupRow {
  id: string;
  name: string;
  emoji: string | null;
  invite_code: string;
  leaderboard_type: LeaderboardType;
  member_count: number;
}

function mapGroup(r: GroupRow): GroupSummary {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? "🏆",
    inviteCode: r.invite_code,
    leaderboardType: r.leaderboard_type,
    memberCount: Number(r.member_count),
  };
}

function generateInviteCode(): string {
  return `STK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Create a group and add the creator as its first member. */
export async function createGroup(
  creatorAddress: string,
  name: string,
  emoji: string,
  leaderboardType: LeaderboardType = "streak"
): Promise<GroupSummary> {
  const inviteCode = generateInviteCode();
  const rows = (await sql`
    insert into groups (name, emoji, invite_code, created_by, leaderboard_type)
    values (${name}, ${emoji}, ${inviteCode}, ${creatorAddress}, ${leaderboardType})
    returning id, name, emoji, invite_code, leaderboard_type
  `) as Omit<GroupRow, "member_count">[];
  const g = rows[0];
  await sql`
    insert into group_members (group_id, user_address)
    values (${g.id}, ${creatorAddress})
    on conflict do nothing
  `;
  return mapGroup({ ...g, member_count: 1 });
}

/** Join a group by invite code. Returns the group, or null if the code is invalid. */
export async function joinGroup(
  userAddress: string,
  inviteCode: string
): Promise<GroupSummary | null> {
  const found = (await sql`
    select id, name, emoji, invite_code, leaderboard_type
    from groups where invite_code = ${inviteCode.toUpperCase()}
  `) as Omit<GroupRow, "member_count">[];
  if (found.length === 0) return null;
  const g = found[0];
  await sql`
    insert into group_members (group_id, user_address)
    values (${g.id}, ${userAddress})
    on conflict do nothing
  `;
  const counts = (await sql`
    select count(*)::int as c from group_members where group_id = ${g.id}
  `) as { c: number }[];
  return mapGroup({ ...g, member_count: counts[0].c });
}

/** All groups the user belongs to, with member counts. */
export async function getUserGroups(userAddress: string): Promise<GroupSummary[]> {
  const rows = (await sql`
    select g.id, g.name, g.emoji, g.invite_code, g.leaderboard_type,
           (select count(*)::int from group_members m where m.group_id = g.id) as member_count
    from group_members gm
    join groups g on g.id = gm.group_id
    where gm.user_address = ${userAddress}
    order by g.created_at desc
  `) as GroupRow[];
  return rows.map(mapGroup);
}

// ─── Activity feed (group-scoped) ───────────────────────────────────────

interface ActivityRow {
  id: string;
  type: ActivityItem["type"];
  username: string;
  avatar: AvatarConfig;
  message: string;
  created_at: string;
  reactions: { [emoji: string]: number } | null;
}

export async function getGroupActivity(groupId: string): Promise<ActivityItem[]> {
  const rows = (await sql`
    select
      e.id, e.type, e.message, e.created_at, e.reactions,
      coalesce(u.username, 'Someone') as username,
      coalesce(u.avatar, '{}'::jsonb) as avatar
    from group_activity_events e
    left join users u on u.wallet_address = e.actor_address
    where e.group_id = ${groupId}
    order by e.created_at desc
    limit 50
  `) as ActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    username: r.username,
    avatar: r.avatar,
    message: r.message,
    timestamp: r.created_at,
    reactions: r.reactions ?? {},
  }));
}

// ─── Notifications (personal Inbox feed) ─────────────────────────────────

/** Compact relative-time label for the Inbox ("just now", "2h ago", "3d ago"). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.floor(day / 7)}w ago`;
}

interface NotificationRow {
  id: string;
  type: Notification["type"];
  title: string;
  body: string;
  icon: string | null;
  read: boolean;
  created_at: string;
}

/** A user's personal notifications, newest first. */
export async function getNotifications(walletAddress: string): Promise<Notification[]> {
  const rows = (await sql`
    select id, type, title, body, icon, read, created_at
    from notifications
    where user_address = ${walletAddress}
    order by created_at desc
    limit 50
  `) as NotificationRow[];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    icon: r.icon ?? "🔔",
    read: r.read,
    timestamp: relativeTime(r.created_at),
  }));
}

/** Mark all of a user's notifications as read (called when they open the Inbox). */
export async function markNotificationsRead(walletAddress: string): Promise<void> {
  await sql`update notifications set read = true where user_address = ${walletAddress} and read = false`;
}

/** Count of unread notifications — powers the Inbox nav badge. */
export async function getUnreadNotificationCount(walletAddress: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as n from notifications
    where user_address = ${walletAddress} and read = false
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/** A user's per-type notification opt-outs ({} = all on). */
export async function getNotificationPrefs(
  walletAddress: string
): Promise<Record<string, boolean>> {
  const rows = (await sql`
    select notification_prefs from users where wallet_address = ${walletAddress}
  `) as { notification_prefs: Record<string, boolean> | null }[];
  return rows[0]?.notification_prefs ?? {};
}

/** Replace a user's notification prefs (full object; keys set false = muted). */
export async function updateNotificationPrefs(
  walletAddress: string,
  prefs: Record<string, boolean>
): Promise<Record<string, boolean>> {
  await sql`
    update users set notification_prefs = ${JSON.stringify(prefs)}
    where wallet_address = ${walletAddress}
  `;
  return prefs;
}

// ─── Earned badges (profile) ─────────────────────────────────────────────

/** The badge ids a user has actually earned. Profile marks only these "Earned". */
export async function getUserBadges(walletAddress: string): Promise<string[]> {
  const rows = (await sql`
    select badge_id from user_badges where user_address = ${walletAddress}
  `) as { badge_id: string }[];
  return rows.map((r) => r.badge_id);
}

// ─── My-groups activity (Inbox group feed) ───────────────────────────────

/**
 * Milestone activity across all groups the user belongs to (their groupmates'
 * notable moments). Powers the Inbox "From your groups" feed — read-only,
 * no reactions.
 */
export async function getMyGroupsActivity(walletAddress: string): Promise<ActivityItem[]> {
  // Respect the "group" notification opt-out.
  const prefRows = (await sql`
    select notification_prefs from users where wallet_address = ${walletAddress}
  `) as { notification_prefs: Record<string, boolean> | null }[];
  if (!prefAllows(prefRows[0]?.notification_prefs, "group")) return [];

  const rows = (await sql`
    select e.id, e.type, e.message, e.created_at,
           coalesce(u.username, 'Someone') as username,
           coalesce(u.avatar, '{}'::jsonb) as avatar
    from group_activity_events e
    join group_members gm on gm.group_id = e.group_id
    left join users u on u.wallet_address = e.actor_address
    where gm.user_address = ${walletAddress}
    order by e.created_at desc
    limit 50
  `) as (ActivityRow & { created_at: string })[];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    username: r.username,
    avatar: r.avatar,
    message: r.message,
    timestamp: relativeTime(r.created_at),
    reactions: {},
  }));
}

// ─── Round Champion race (per-round pick standings) ──────────────────────

export interface RoundRacer {
  username: string;
  avatar: AvatarConfig;
  correctCount: number;
  picksMade: number;
  streak: number;
  isCurrentUser: boolean;
}

export interface RoundRace {
  round: string;
  /** Set once the round is fully finished and a champion has been crowned. */
  crowned: { username: string; correctCount: number } | null;
  racers: RoundRacer[];
}

interface RoundRacerRow {
  user_address: string;
  username: string;
  avatar: AvatarConfig;
  current_streak: number;
  correct_count: number;
  picks_made: number;
}

/**
 * The Round Champion race for a given knockout round: everyone ranked by
 * correct picks this round (tiebreak current streak), plus the crowned
 * champion if the round has completed. Powers the Knockout Stage card.
 */
export async function getRoundRace(
  round: string,
  walletAddress?: string
): Promise<RoundRace> {
  const rows = (await sql`
    select p.user_address, u.username, u.avatar, u.current_streak,
           count(*) filter (where p.correct)::int as correct_count,
           count(*)::int as picks_made
    from picks p
    join fixtures f on f.id = p.fixture_id
    join users u on u.wallet_address = p.user_address
    where f.round = ${round} and p.resolved = true
    group by p.user_address, u.username, u.avatar, u.current_streak
    having count(*) filter (where p.correct) > 0
    order by correct_count desc, u.current_streak desc
    limit 50
  `) as RoundRacerRow[];

  const crownRow = (await sql`
    select u.username, rc.correct_count
    from round_champions rc
    join users u on u.wallet_address = rc.user_address
    where rc.round = ${round} and rc.group_id is null
    limit 1
  `) as { username: string; correct_count: number }[];

  return {
    round,
    crowned: crownRow.length
      ? { username: crownRow[0].username, correctCount: crownRow[0].correct_count }
      : null,
    racers: rows.map((r) => ({
      username: r.username,
      avatar: r.avatar,
      correctCount: r.correct_count,
      picksMade: r.picks_made,
      streak: r.current_streak,
      isCurrentUser: !!walletAddress && r.user_address === walletAddress,
    })),
  };
}

// ─── Announcements ─────────────────────────────────────────────────────────

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  kind: string;
  cta_label: string | null;
  cta_href: string | null;
  priority: number;
}

/** Announcements that are live right now (active + within their window), top priority first. */
export async function getActiveAnnouncements(): Promise<AnnouncementRow[]> {
  return (await sql`
    select id, title, body, icon, kind, cta_label, cta_href, priority
    from announcements
    where active = true
      and starts_at <= now()
      and (ends_at is null or ends_at >= now())
      and audience = 'all'
    order by priority desc, created_at desc
    limit 10
  `) as AnnouncementRow[];
}
