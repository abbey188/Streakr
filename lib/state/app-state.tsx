"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AvatarConfig, Fixture, GroupMember, ActivityItem, FeedItem } from "@/src/types";
import { INITIAL_LEADERBOARD, INITIAL_ACTIVITY } from "@/src/data/fixtures";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchMe, createUser, updateAvatar as apiUpdateAvatar, makePick as apiMakePick,
  fetchFixtures, fetchFeed, joinGroup,
} from "@/lib/api/client";

/**
 * App-wide game state, lifted out of the old single-page App.tsx so every
 * route (/play, /hub, /profile, …) can read and mutate the same user/game
 * state. Navigation itself is owned by the Next.js router — this context holds
 * data + actions only, never the current screen.
 *
 * profileStatus drives the auth/onboarding guards:
 *   'loading' → still resolving session/profile (show splash)
 *   'none'    → authenticated but no DB profile yet → onboarding/identity
 *   'ready'   → full profile loaded → app routes allowed
 */

export type ProfileStatus = "loading" | "none" | "ready";

interface ShareGroupInfo {
  name: string;
  inviteCode: string;
  leaderboard: GroupMember[];
  emoji?: string;
}

interface AppState {
  profileStatus: ProfileStatus;

  avatar: AvatarConfig;
  streak: number;
  personalBest: number;
  points: number;
  userEmail: string;

  fixtures: Fixture[];
  feed: FeedItem[];
  leaderboard: GroupMember[];
  activity: ActivityItem[];

  // Ephemeral UI
  toastMessage: string;
  activeShareSheet: "streak" | "invite" | null;
  shareGroupInfo: ShareGroupInfo | null;
  momentToShare: FeedItem | null; // a Live-Feed moment being shared to a squad
  showTour: boolean; // first-run guided tour overlay on /play
  dismissTour: () => void;

  // Actions
  triggerToast: (msg: string) => void;
  makePick: (fixtureId: string, pick: "A" | "B") => void;
  updateUserAvatar: (newAvatar: AvatarConfig) => void;
  createProfile: (config: AvatarConfig) => Promise<void>;
  openShareSheet: (type: "streak" | "invite", info?: ShareGroupInfo) => void;
  closeShareSheet: () => void;
  openMomentShare: (item: FeedItem) => void;
  closeMomentShare: () => void;
}

const DEFAULT_AVATAR: AvatarConfig = {
  username: "GoalScorer99",
  skinTone: "#FFEDD5",
  kitPrimary: "#2563EB",
  kitSecondary: "#FACC15",
  expression: "happy",
};

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within <AppStateProvider>");
  return ctx;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const router = useRouter();

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [bootstrapped, setBootstrapped] = useState(false);

  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [streak, setStreak] = useState(0);
  // Start at zero — real values hydrate from the DB on load. Never show fake
  // stats (a new user has 0 points / 0 best until they actually earn them).
  const [personalBest, setPersonalBest] = useState(0);
  const [points, setPoints] = useState(0);
  const [userEmail, setUserEmail] = useState("");

  // Fixtures start empty and hydrate from Neon — never flash mock matches on
  // first paint. (leaderboard/activity mocks below are only share-card fallbacks,
  // not shown on Play, so they stay.)
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<GroupMember[]>(INITIAL_LEADERBOARD);
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);

  const [toastMessage, setToastMessage] = useState("");
  const [activeShareSheet, setActiveShareSheet] = useState<"streak" | "invite" | null>(null);
  const [shareGroupInfo, setShareGroupInfo] = useState<ShareGroupInfo | null>(null);
  const [momentToShare, setMomentToShare] = useState<FeedItem | null>(null);
  const [showTour, setShowTour] = useState(false);
  // Set when a new user joins via an invite link — on tour dismissal we route
  // them to Groups so they land in the squad they were invited to.
  const [landOnGroupsAfterTour, setLandOnGroupsAfterTour] = useState(false);
  const dismissTour = useCallback(() => {
    setShowTour(false);
    if (landOnGroupsAfterTour) {
      setLandOnGroupsAfterTour(false);
      router.push("/groups");
    }
  }, [landOnGroupsAfterTour, router]);

  // Track the dismiss timer so rapid toasts don't clear each other early.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 2500);
  }, []);

  // ─── Profile bootstrap (returning-user rehydrate / new-user detection) ────
  useEffect(() => {
    if (identity.isLoading) {
      setProfileStatus("loading");
      return;
    }
    if (!identity.isAuthenticated) {
      setProfileStatus("none");
      setBootstrapped(false);
      return;
    }
    if (!identity.walletAddress) {
      setProfileStatus("loading"); // wallet still creating
      return;
    }
    if (bootstrapped) return;
    setBootstrapped(true);
    setProfileStatus("loading");

    (async () => {
      try {
        const user = await fetchMe(identity.walletAddress!);
        if (user) {
          setAvatar(user.avatar);
          setStreak(user.currentStreak);
          setPersonalBest(user.personalBest);
          setPoints(user.points);
          setUserEmail(user.email ?? identity.email ?? "");
          setProfileStatus("ready");
        } else {
          setUserEmail(identity.email ?? "");
          setProfileStatus("none"); // authenticated, needs onboarding
        }
      } catch {
        setUserEmail(identity.email ?? "");
        setProfileStatus("none");
      }
    })();
  }, [identity.isLoading, identity.isAuthenticated, identity.walletAddress, identity.email, bootstrapped]);

  // Keep a live view of fixtures for the poller to read without re-arming.
  const fixturesRef = useRef<Fixture[]>([]);
  fixturesRef.current = fixtures;

  // Fixtures from Neon, polled so live scores + completed results stay fresh
  // without a manual refresh. ADAPTIVE: every 15s while a match is live, ~45s
  // when idle — visibility-gated so backgrounded tabs don't poll.
  useEffect(() => {
    if (!identity.walletAddress) return;
    const wallet = identity.walletAddress;
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchFixtures(wallet)
        .then((rows) => { if (!cancelled && rows.length > 0) setFixtures(rows); })
        .catch(() => { /* keep last-good fixtures on failure */ });
      // The Live Feed rides the same adaptive cadence — one unified live-data
      // core, so the Hub feed is fresh app-wide. Keep last-good on a failed poll
      // (don't flicker the feed to empty mid-match); a successful [] still clears.
      fetchFeed()
        .then((items) => { if (!cancelled) setFeed(items); })
        .catch(() => { /* keep last-good feed on failure */ });
    };
    load();
    let tick = 0;
    const t = setInterval(() => {
      const fx = fixturesRef.current;
      const anyLive = fx.some((f) => f.status === "live");
      // A kickoff within the next ~20 min (or a match that should have started but
      // hasn't flipped yet) counts as "active" so we catch the upcoming→live moment.
      const near = fx.some((f) => {
        if (f.status !== "upcoming" || !f.kickoffAt) return false;
        const ms = Date.parse(f.kickoffAt) - Date.now();
        return ms < 20 * 60_000 && ms > -4 * 60 * 60_000;
      });
      tick++;
      // ACTIVE (a match is live or imminent) → 15s so the Hub keeps broadcast pace.
      // FULLY IDLE (nothing live, none near) → ~every 10 min, which is longer than
      // Neon's 5-min autosuspend, so compute scales to zero between polls instead of
      // being held awake 24/7. Idle fixtures/feed don't change, so nothing is lost.
      if (anyLive || near) load();
      else if (tick % 40 === 0) load();
    }, 15_000);
    const onVisible = () => { if (!document.hidden) load(); }; // fresh data on return
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [identity.walletAddress]);

  // Consume a pending group invite (from a /join?code link) once the user is
  // signed in + onboarded — works for existing members and brand-new signups.
  useEffect(() => {
    if (profileStatus !== "ready" || !identity.walletAddress) return;
    let code: string | null = null;
    try { code = localStorage.getItem("streakr_invite"); } catch { /* no storage */ }
    if (!code) return;
    try { localStorage.removeItem("streakr_invite"); } catch { /* ignore */ }
    joinGroup(identity.walletAddress, code)
      .then((g) => {
        if (!g) { triggerToast("That invite code didn't match a squad."); return; }
        triggerToast(`Joined ${g.name}! 🛡️`);
        // If this is a first-run user (the tour is queued), send them to Groups
        // once they finish it. Existing users are already on the Groups page.
        setShowTour((tourQueued) => {
          if (tourQueued) setLandOnGroupsAfterTour(true);
          return tourQueued;
        });
      })
      .catch(() => { /* ignore */ });
  }, [profileStatus, identity.walletAddress, triggerToast]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const createProfile = useCallback(
    async (config: AvatarConfig) => {
      setAvatar(config);
      if (identity.walletAddress) {
        try {
          await createUser({
            walletAddress: identity.walletAddress,
            username: config.username,
            email: identity.email,
            avatar: config,
          });
        } catch {
          triggerToast("Saved locally (DB sync will retry).");
        }
      }
      setProfileStatus("ready");
      setShowTour(true); // first-run guided tour on /play
      // Add the user to the local leaderboard on first onboard.
      setLeaderboard((prev) => {
        if (prev.some((m) => m.id === "currentUser")) return prev;
        return [
          ...prev,
          {
            id: "currentUser",
            rank: prev.length + 1,
            username: config.username || "GoalScorer99",
            avatar: config,
            streak,
            change: "same" as const,
            isCurrentUser: true,
          },
        ];
      });
    },
    [identity.walletAddress, identity.email, streak, triggerToast]
  );

  const updateUserAvatar = useCallback(
    (newAvatar: AvatarConfig) => {
      setAvatar(newAvatar);
      setLeaderboard((prev) =>
        prev.map((m) =>
          m.id === "currentUser" ? { ...m, username: newAvatar.username, avatar: newAvatar } : m
        )
      );
      triggerToast("Avatar Identity updated!");
      if (identity.walletAddress) {
        apiUpdateAvatar(identity.walletAddress, newAvatar).catch(() => {
          triggerToast("Avatar saved locally (DB sync will retry).");
        });
      }
    },
    [identity.walletAddress, triggerToast]
  );

  const makePick = useCallback(
    (fixtureId: string, pick: "A" | "B") => {
      const match = fixtures.find((f) => f.id === fixtureId);
      const prevPick = match?.userPick; // for revert if the server rejects
      // Optimistic update + toast.
      setFixtures((prev) =>
        prev.map((f) => (f.id === fixtureId ? { ...f, userPick: pick } : f))
      );
      if (match) {
        const teamName = pick === "A" ? match.teamA.name : match.teamB.name;
        triggerToast(`Pick locked: ${teamName} to advance!`);
      }
      if (identity.walletAddress) {
        apiMakePick(identity.walletAddress, fixtureId, pick)
          .then((res) => {
            if (!res.ok) {
              // Window closed between render and submit → revert + explain.
              setFixtures((prev) =>
                prev.map((f) => (f.id === fixtureId ? { ...f, userPick: prevPick } : f))
              );
              const why =
                res.reason === "goal" ? "a goal was scored"
                : res.reason === "red" ? "a red card"
                : "the match moved on";
              triggerToast(`Picks just closed — ${why}.`);
            }
          })
          .catch(() => {});
      }
    },
    [fixtures, identity.walletAddress, triggerToast]
  );

  const openShareSheet = useCallback((type: "streak" | "invite", info?: ShareGroupInfo) => {
    if (info) setShareGroupInfo(info);
    setActiveShareSheet(type);
  }, []);

  const closeShareSheet = useCallback(() => {
    setActiveShareSheet(null);
    setShareGroupInfo(null);
  }, []);

  const openMomentShare = useCallback((item: FeedItem) => setMomentToShare(item), []);
  const closeMomentShare = useCallback(() => setMomentToShare(null), []);

  const value: AppState = {
    profileStatus,
    avatar, streak, personalBest, points, userEmail,
    fixtures, feed, leaderboard, activity,
    toastMessage, activeShareSheet, shareGroupInfo, showTour, dismissTour,
    momentToShare,
    triggerToast, makePick, updateUserAvatar, createProfile,
    openShareSheet, closeShareSheet, openMomentShare, closeMomentShare,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
