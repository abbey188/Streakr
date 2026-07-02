import type {
  Fixture,
  GroupMember,
  ActivityItem,
  Badge,
  AvatarConfig,
  Notification,
} from "@/src/types";
import type { MatchDetail, FormEntry } from "@/lib/txline/types";

/**
 * Typed browser → API client. The single place the frontend talks to our
 * server routes. Every function returns the exact src/types.ts shapes the
 * components already consume, so screens stay unchanged.
 */

/** User profile state as returned by /api/me and /api/users. */
export interface UserState {
  walletAddress: string;
  username: string;
  email: string | null;
  avatar: AvatarConfig;
  points: number;
  currentStreak: number;
  personalBest: number;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── User / identity ─────────────────────────────────────────────────────

/** Returning-user lookup. null = first-time user (no profile yet). */
export async function fetchMe(walletAddress: string): Promise<UserState | null> {
  const res = await fetch(`/api/me?wallet=${encodeURIComponent(walletAddress)}`);
  const { user } = await jsonOrThrow<{ user: UserState | null }>(res);
  return user;
}

/** Signup — persist a new user with their chosen mascot. */
export async function createUser(input: {
  walletAddress: string;
  username: string;
  email?: string | null;
  avatar: AvatarConfig;
}): Promise<UserState> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const { user } = await jsonOrThrow<{ user: UserState }>(res);
  return user;
}

/** Update the mascot/avatar from the profile editor. */
export async function updateAvatar(
  walletAddress: string,
  avatar: AvatarConfig
): Promise<UserState> {
  const res = await fetch("/api/users/avatar", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, avatar }),
  });
  const { user } = await jsonOrThrow<{ user: UserState }>(res);
  return user;
}

// ─── Gameplay ──────────────────────────────────────────────────────────────

export async function fetchFixtures(walletAddress?: string): Promise<Fixture[]> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await fetch(`/api/fixtures${qs}`);
  const { fixtures } = await jsonOrThrow<{ fixtures: Fixture[] }>(res);
  return fixtures;
}

/** Lock or change a pick. Returns false if rejected (match already kicked off). */
export async function makePick(
  walletAddress: string,
  fixtureId: string,
  pick: "A" | "B"
): Promise<boolean> {
  const res = await fetch("/api/picks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, fixtureId, pick }),
  });
  if (res.status === 409) return false;
  await jsonOrThrow<{ ok: true }>(res);
  return true;
}

// ─── Social / meta ─────────────────────────────────────────────────────────

/** Group leaderboard now returns points too (groups can rank by streak or points). */
export async function fetchLeaderboard(
  groupId: string,
  walletAddress?: string
): Promise<GlobalLeaderboardEntry[]> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await fetch(`/api/groups/${groupId}/leaderboard${qs}`);
  const { leaderboard } = await jsonOrThrow<{ leaderboard: GlobalLeaderboardEntry[] }>(res);
  return leaderboard;
}

export async function fetchActivity(groupId: string): Promise<ActivityItem[]> {
  const res = await fetch(`/api/groups/${groupId}/activity`);
  const { activity } = await jsonOrThrow<{ activity: ActivityItem[] }>(res);
  return activity;
}

// ─── Notifications (personal Inbox feed) ─────────────────────────────────

/** The signed-in user's personal notifications (pick results, badges, crowns). */
export async function fetchNotifications(walletAddress: string): Promise<Notification[]> {
  const res = await fetch(`/api/me/notifications?wallet=${encodeURIComponent(walletAddress)}`);
  const { notifications } = await jsonOrThrow<{ notifications: Notification[] }>(res);
  return notifications;
}

/** Mark all of the user's notifications read (fire-and-forget on Inbox open). */
export async function markNotificationsRead(walletAddress: string): Promise<void> {
  await fetch("/api/me/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
}

/** The badge ids the user has earned (profile marks only these). */
export async function fetchUserBadges(walletAddress: string): Promise<string[]> {
  const res = await fetch(`/api/me/badges?wallet=${encodeURIComponent(walletAddress)}`);
  const { badgeIds } = await jsonOrThrow<{ badgeIds: string[] }>(res);
  return badgeIds;
}

/** Milestone activity from the user's groups (Inbox group feed). */
export async function fetchMyGroupsActivity(walletAddress: string): Promise<ActivityItem[]> {
  const res = await fetch(`/api/me/groups-activity?wallet=${encodeURIComponent(walletAddress)}`);
  const { activity } = await jsonOrThrow<{ activity: ActivityItem[] }>(res);
  return activity;
}

/** Unread notification count for the Inbox nav badge. */
export async function fetchUnreadCount(walletAddress: string): Promise<number> {
  const res = await fetch(`/api/me/notifications/unread?wallet=${encodeURIComponent(walletAddress)}`);
  const { count } = await jsonOrThrow<{ count: number }>(res);
  return count;
}

/** The user's per-type notification opt-outs ({} = all on). */
export async function fetchNotificationPrefs(walletAddress: string): Promise<Record<string, boolean>> {
  const res = await fetch(`/api/me/notification-prefs?wallet=${encodeURIComponent(walletAddress)}`);
  const { prefs } = await jsonOrThrow<{ prefs: Record<string, boolean> }>(res);
  return prefs;
}

/** Save the user's notification prefs (full object). */
export async function updateNotificationPrefs(
  walletAddress: string,
  prefs: Record<string, boolean>
): Promise<Record<string, boolean>> {
  const res = await fetch("/api/me/notification-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, prefs }),
  });
  const out = await jsonOrThrow<{ prefs: Record<string, boolean> }>(res);
  return out.prefs;
}

// ─── Round Champion race ─────────────────────────────────────────────────

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
  crowned: { username: string; correctCount: number } | null;
  racers: RoundRacer[];
}

/** Round Champion race standings for a knockout round. */
export async function fetchRoundRace(
  round: string,
  walletAddress?: string
): Promise<RoundRace> {
  const qs = new URLSearchParams({ round });
  if (walletAddress) qs.set("wallet", walletAddress);
  const res = await fetch(`/api/rounds/race?${qs.toString()}`);
  const { race } = await jsonOrThrow<{ race: RoundRace }>(res);
  return race;
}

// ─── Leaderboards & friend groups ──────────────────────────────────────────

export type LeaderboardType = "streak" | "points" | "both";

export interface GroupSummary {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
  leaderboardType: LeaderboardType;
}

/** A global leaderboard row: GroupMember plus points. */
export type GlobalLeaderboardEntry = GroupMember & { points: number };

/** Global leaderboard — all users by streak (then points). */
export async function fetchGlobalLeaderboard(
  walletAddress?: string
): Promise<GlobalLeaderboardEntry[]> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await fetch(`/api/leaderboard/global${qs}`);
  const { leaderboard } = await jsonOrThrow<{ leaderboard: GlobalLeaderboardEntry[] }>(res);
  return leaderboard;
}

/** Groups the user belongs to. */
export async function fetchMyGroups(walletAddress: string): Promise<GroupSummary[]> {
  const res = await fetch(`/api/groups?wallet=${encodeURIComponent(walletAddress)}`);
  const { groups } = await jsonOrThrow<{ groups: GroupSummary[] }>(res);
  return groups;
}

export async function createGroup(
  walletAddress: string,
  name: string,
  emoji: string,
  leaderboardType: LeaderboardType = "streak"
): Promise<GroupSummary> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, name, emoji, leaderboardType }),
  });
  const { group } = await jsonOrThrow<{ group: GroupSummary }>(res);
  return group;
}

/** Join by invite code. Returns null if the code is invalid (404). */
export async function joinGroup(
  walletAddress: string,
  inviteCode: string
): Promise<GroupSummary | null> {
  const res = await fetch("/api/groups/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, inviteCode }),
  });
  if (res.status === 404) return null;
  const { group } = await jsonOrThrow<{ group: GroupSummary }>(res);
  return group;
}

export async function fetchBadges(): Promise<Badge[]> {
  const res = await fetch("/api/badges");
  const { badges } = await jsonOrThrow<{ badges: Badge[] }>(res);
  return badges;
}

export interface MatchDetailResponse {
  detail: MatchDetail;
  formA: FormEntry[];
  formB: FormEntry[];
}

/** Match detail (score + timeline + stats) + each team's last-5 form. */
export async function fetchMatchDetail(fixtureId: string): Promise<MatchDetailResponse | null> {
  const res = await fetch(`/api/matches/${encodeURIComponent(fixtureId)}`);
  if (res.status === 404) return null;
  return jsonOrThrow<MatchDetailResponse>(res);
}
