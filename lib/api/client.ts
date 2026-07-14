import type {
  Fixture,
  GroupMember,
  ActivityItem,
  Badge,
  AvatarConfig,
  Notification,
  SquadItem,
  SquadReaction,
  FeedItem,
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

// ─── Auth: attach the caller's Privy access token to every request ─────────
// The identity provider registers a token getter here. `apiFetch` attaches the
// token as a Bearer header. Fully DEFENSIVE: if the token isn't ready or the
// getter throws, the request still goes out exactly as before — the server
// ignores the header until server-side auth is switched on (AUTH_ENFORCED).
let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: (() => Promise<string | null>) | null): void {
  authTokenGetter = fn;
}

async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retried = false
): Promise<Response> {
  let authHeader: Record<string, string> = {};
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) authHeader = { Authorization: `Bearer ${token}` };
    } catch {
      /* token not ready → send without it */
    }
  }
  const res = await fetch(input, {
    ...init,
    headers: { ...authHeader, ...(init.headers ?? {}) },
  });

  // Graceful recovery: a 401 usually means the token wasn't ready on the first
  // try (e.g. right after load). Re-fetch a fresh token and retry ONCE. A 401 is
  // returned before any mutation runs, so retrying a POST is safe. If it still
  // 401s, the error propagates and the caller shows a normal failure.
  if (res.status === 401 && authTokenGetter && !retried) {
    return apiFetch(input, init, true);
  }
  return res;
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
  const res = await apiFetch(`/api/me?wallet=${encodeURIComponent(walletAddress)}`);
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
  const res = await apiFetch("/api/users", {
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
  const res = await apiFetch("/api/users/avatar", {
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
  const res = await apiFetch(`/api/fixtures${qs}`);
  const { fixtures } = await jsonOrThrow<{ fixtures: Fixture[] }>(res);
  return fixtures;
}

/** The Hub's Live Feed — recent match moments, newest-first. Never throws
 *  (returns [] on failure) so a feed hiccup can't break a page that polls it. */
export async function fetchFeed(limit = 60): Promise<FeedItem[]> {
  try {
    const res = await apiFetch(`/api/feed?limit=${limit}`);
    const { feed } = await jsonOrThrow<{ feed: FeedItem[] }>(res);
    return feed;
  } catch {
    return [];
  }
}

export type PickResult = { ok: boolean; reason?: string };

/** Lock or change a pick. On rejection (409) returns { ok:false, reason } — the
 *  reason says why the window closed (goal / red / secondhalf / finished). */
export async function makePick(
  walletAddress: string,
  fixtureId: string,
  pick: "A" | "B"
): Promise<PickResult> {
  const res = await apiFetch("/api/picks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, fixtureId, pick }),
  });
  if (res.status === 409) {
    let reason: string | undefined;
    try { reason = (await res.json())?.reason; } catch { /* ignore */ }
    return { ok: false, reason };
  }
  await jsonOrThrow<{ ok: true }>(res);
  return { ok: true };
}

// ─── Social / meta ─────────────────────────────────────────────────────────

/** Group leaderboard now returns points too (groups can rank by streak or points). */
export async function fetchLeaderboard(
  groupId: string,
  walletAddress?: string
): Promise<GlobalLeaderboardEntry[]> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await apiFetch(`/api/groups/${groupId}/leaderboard${qs}`);
  const { leaderboard } = await jsonOrThrow<{ leaderboard: GlobalLeaderboardEntry[] }>(res);
  return leaderboard;
}

export async function fetchActivity(groupId: string): Promise<ActivityItem[]> {
  const res = await apiFetch(`/api/groups/${groupId}/activity`);
  const { activity } = await jsonOrThrow<{ activity: ActivityItem[] }>(res);
  return activity;
}

/** The merged Squad Room timeline (events + messages, reactions, replies). */
export async function fetchSquadFeed(
  groupId: string,
  walletAddress?: string
): Promise<SquadItem[]> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await apiFetch(`/api/groups/${groupId}/feed${qs}`);
  const { feed } = await jsonOrThrow<{ feed: SquadItem[] }>(res);
  return feed;
}

/** Post a Squad Room message — a root, or a one-level reply to a message/event. */
export async function sendSquadMessage(
  groupId: string,
  walletAddress: string,
  body: string,
  parent?: { type: "message" | "event"; id: string }
): Promise<{ id: string }> {
  const res = await apiFetch(`/api/groups/${groupId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      body,
      parentMessageId: parent?.type === "message" ? parent.id : undefined,
      parentEventId: parent?.type === "event" ? parent.id : undefined,
    }),
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** Soft-delete your own Squad Room message. */
export async function deleteSquadMessage(
  groupId: string,
  messageId: string,
  walletAddress: string
): Promise<{ ok: boolean }> {
  const res = await apiFetch(
    `/api/groups/${groupId}/messages/${messageId}?wallet=${encodeURIComponent(walletAddress)}`,
    { method: "DELETE" }
  );
  return jsonOrThrow<{ ok: boolean }>(res);
}

/** Toggle a reaction; returns the target's authoritative fresh summary. */
export async function toggleSquadReaction(
  groupId: string,
  walletAddress: string,
  targetType: "message" | "event",
  targetId: string,
  emoji: string
): Promise<{ added: boolean; reactions: SquadReaction[] }> {
  const res = await apiFetch(`/api/groups/${groupId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, targetType, targetId, emoji }),
  });
  return jsonOrThrow<{ added: boolean; reactions: SquadReaction[] }>(res);
}

// ─── Notifications (personal Inbox feed) ─────────────────────────────────

/** The signed-in user's personal notifications (pick results, badges, crowns). */
export async function fetchNotifications(walletAddress: string): Promise<Notification[]> {
  const res = await apiFetch(`/api/me/notifications?wallet=${encodeURIComponent(walletAddress)}`);
  const { notifications } = await jsonOrThrow<{ notifications: Notification[] }>(res);
  return notifications;
}

/** Mark all of the user's notifications read (fire-and-forget on Inbox open). */
export async function markNotificationsRead(walletAddress: string): Promise<void> {
  await apiFetch("/api/me/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
}

/** Clear (delete) all of the user's personal notifications — Inbox "Clear all". */
export async function clearNotifications(walletAddress: string): Promise<void> {
  await apiFetch("/api/me/notifications", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
}

/**
 * Permanently delete the caller's account + all data (right to erasure). The
 * server identifies the caller from their token, so no wallet is sent.
 */
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch("/api/me/account", { method: "DELETE" });
  await jsonOrThrow<{ ok: true }>(res);
}

/** Register a Web Push subscription for the signed-in user. */
export async function apiSubscribePush(subscription: unknown): Promise<void> {
  const res = await apiFetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
  await jsonOrThrow<{ ok: true }>(res);
}

/** Remove a Web Push subscription by endpoint. */
export async function apiUnsubscribePush(endpoint: string): Promise<void> {
  const res = await apiFetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  await jsonOrThrow<{ ok: true }>(res);
}

/** The badge ids the user has earned (profile marks only these). */
export async function fetchUserBadges(walletAddress: string): Promise<string[]> {
  const res = await apiFetch(`/api/me/badges?wallet=${encodeURIComponent(walletAddress)}`);
  const { badgeIds } = await jsonOrThrow<{ badgeIds: string[] }>(res);
  return badgeIds;
}

/** Milestone activity from the user's groups (Inbox group feed). */
export async function fetchMyGroupsActivity(walletAddress: string): Promise<ActivityItem[]> {
  const res = await apiFetch(`/api/me/groups-activity?wallet=${encodeURIComponent(walletAddress)}`);
  const { activity } = await jsonOrThrow<{ activity: ActivityItem[] }>(res);
  return activity;
}

/** Unread notification count for the Inbox nav badge. */
export async function fetchUnreadCount(walletAddress: string): Promise<number> {
  const res = await apiFetch(`/api/me/notifications/unread?wallet=${encodeURIComponent(walletAddress)}`);
  const { count } = await jsonOrThrow<{ count: number }>(res);
  return count;
}

/** The user's per-type notification opt-outs ({} = all on). */
export async function fetchNotificationPrefs(walletAddress: string): Promise<Record<string, boolean>> {
  const res = await apiFetch(`/api/me/notification-prefs?wallet=${encodeURIComponent(walletAddress)}`);
  const { prefs } = await jsonOrThrow<{ prefs: Record<string, boolean> }>(res);
  return prefs;
}

/** Save the user's notification prefs (full object). */
export async function updateNotificationPrefs(
  walletAddress: string,
  prefs: Record<string, boolean>
): Promise<Record<string, boolean>> {
  const res = await apiFetch("/api/me/notification-prefs", {
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
  const res = await apiFetch(`/api/rounds/race?${qs.toString()}`);
  const { race } = await jsonOrThrow<{ race: RoundRace }>(res);
  return race;
}

/** The race for "The Streakr" — overall standings, plus the crown once settled. */
export interface TournamentRacer {
  username: string;
  avatar: AvatarConfig;
  points: number;
  personalBest: number;
  correctCount: number;
  isCurrentUser: boolean;
}

export interface TournamentRace {
  crowned: { username: string; points: number; personalBest: number; correctCount: number } | null;
  racers: TournamentRacer[];
}

export async function fetchTournamentRace(walletAddress?: string): Promise<TournamentRace> {
  const qs = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
  const res = await apiFetch(`/api/champion${qs}`);
  const { race } = await jsonOrThrow<{ race: TournamentRace }>(res);
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
  const res = await apiFetch(`/api/leaderboard/global${qs}`);
  const { leaderboard } = await jsonOrThrow<{ leaderboard: GlobalLeaderboardEntry[] }>(res);
  return leaderboard;
}

/** Groups the user belongs to. */
export async function fetchMyGroups(walletAddress: string): Promise<GroupSummary[]> {
  const res = await apiFetch(`/api/groups?wallet=${encodeURIComponent(walletAddress)}`);
  const { groups } = await jsonOrThrow<{ groups: GroupSummary[] }>(res);
  return groups;
}

export async function createGroup(
  walletAddress: string,
  name: string,
  emoji: string,
  leaderboardType: LeaderboardType = "streak"
): Promise<GroupSummary> {
  const res = await apiFetch("/api/groups", {
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
  const res = await apiFetch("/api/groups/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, inviteCode }),
  });
  if (res.status === 404) return null;
  const { group } = await jsonOrThrow<{ group: GroupSummary }>(res);
  return group;
}

export async function fetchBadges(): Promise<Badge[]> {
  const res = await apiFetch("/api/badges");
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
  const res = await apiFetch(`/api/matches/${encodeURIComponent(fixtureId)}`);
  if (res.status === 404) return null;
  return jsonOrThrow<MatchDetailResponse>(res);
}

// ─── Announcements ─────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  kind: string; // info | tip | warning | update
  ctaLabel: string | null;
  ctaHref: string | null;
  priority: number;
}

/** Live announcements for the glance strip. Dismissal is client-side. */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await apiFetch("/api/announcements");
    const { announcements } = await jsonOrThrow<{
      announcements: Array<{
        id: string; title: string; body: string; icon: string | null; kind: string;
        cta_label: string | null; cta_href: string | null; priority: number;
      }>;
    }>(res);
    return announcements.map((a) => ({
      id: a.id, title: a.title, body: a.body, icon: a.icon, kind: a.kind,
      ctaLabel: a.cta_label, ctaHref: a.cta_href, priority: a.priority,
    }));
  } catch {
    return [];
  }
}
