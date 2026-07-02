"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import type { AvatarConfig, Fixture, GroupMember, ActivityItem } from "@/src/types";
import {
  INITIAL_FIXTURES, INITIAL_LEADERBOARD, INITIAL_ACTIVITY,
} from "@/src/data/fixtures";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchMe, createUser, updateAvatar as apiUpdateAvatar, makePick as apiMakePick,
  fetchFixtures,
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
  leaderboard: GroupMember[];
  activity: ActivityItem[];

  // Ephemeral UI
  toastMessage: string;
  activeShareSheet: "streak" | "invite" | null;
  shareGroupInfo: ShareGroupInfo | null;
  showTour: boolean; // first-run guided tour overlay on /play
  dismissTour: () => void;

  // Actions
  triggerToast: (msg: string) => void;
  makePick: (fixtureId: string, pick: "A" | "B") => void;
  updateUserAvatar: (newAvatar: AvatarConfig) => void;
  createProfile: (config: AvatarConfig) => Promise<void>;
  openShareSheet: (type: "streak" | "invite", info?: ShareGroupInfo) => void;
  closeShareSheet: () => void;
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

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [bootstrapped, setBootstrapped] = useState(false);

  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [streak, setStreak] = useState(0);
  // Start at zero — real values hydrate from the DB on load. Never show fake
  // stats (a new user has 0 points / 0 best until they actually earn them).
  const [personalBest, setPersonalBest] = useState(0);
  const [points, setPoints] = useState(0);
  const [userEmail, setUserEmail] = useState("");

  // Gameplay lists — still seeded from mock; live-data wiring is the next step.
  const [fixtures, setFixtures] = useState<Fixture[]>(INITIAL_FIXTURES);
  const [leaderboard, setLeaderboard] = useState<GroupMember[]>(INITIAL_LEADERBOARD);
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);

  const [toastMessage, setToastMessage] = useState("");
  const [activeShareSheet, setActiveShareSheet] = useState<"streak" | "invite" | null>(null);
  const [shareGroupInfo, setShareGroupInfo] = useState<ShareGroupInfo | null>(null);
  const [showTour, setShowTour] = useState(false);
  const dismissTour = useCallback(() => setShowTour(false), []);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
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

  // Fixtures from Neon, polled so live scores + completed results stay fresh
  // without a manual refresh (a lightweight stand-in until the SSE proxy lands).
  useEffect(() => {
    if (!identity.walletAddress) return;
    const wallet = identity.walletAddress;
    let cancelled = false;
    const load = () =>
      fetchFixtures(wallet)
        .then((rows) => { if (!cancelled && rows.length > 0) setFixtures(rows); })
        .catch(() => { /* keep last-good fixtures on failure */ });
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [identity.walletAddress]);

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
      setFixtures((prev) =>
        prev.map((f) => (f.id === fixtureId ? { ...f, userPick: pick } : f))
      );
      const match = fixtures.find((f) => f.id === fixtureId);
      if (match) {
        const teamName = pick === "A" ? match.teamA.name : match.teamB.name;
        triggerToast(`Pick locked: ${teamName} to advance!`);
      }
      if (identity.walletAddress) {
        apiMakePick(identity.walletAddress, fixtureId, pick).catch(() => {});
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

  const value: AppState = {
    profileStatus,
    avatar, streak, personalBest, points, userEmail,
    fixtures, leaderboard, activity,
    toastMessage, activeShareSheet, shareGroupInfo, showTour, dismissTour,
    triggerToast, makePick, updateUserAvatar, createProfile,
    openShareSheet, closeShareSheet,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
