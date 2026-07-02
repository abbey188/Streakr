"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state/app-state";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchUserBadges, fetchNotificationPrefs, updateNotificationPrefs,
} from "@/lib/api/client";
import ScreenProfile from "@/src/components/ScreenProfile";

export default function ProfilePage() {
  const app = useAppState();
  const identity = useIdentity();
  const router = useRouter();
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    let cancelled = false;
    fetchUserBadges(wallet)
      .then((ids) => { if (!cancelled) setEarnedBadgeIds(ids); })
      .catch(() => { /* no badges on failure */ });
    fetchNotificationPrefs(wallet)
      .then((p) => { if (!cancelled) setNotificationPrefs(p); })
      .catch(() => { /* default all-on */ });
    return () => { cancelled = true; };
  }, [identity.walletAddress]);

  const handleUpdatePrefs = (prefs: Record<string, boolean>) => {
    setNotificationPrefs(prefs); // optimistic
    const wallet = identity.walletAddress;
    if (wallet) updateNotificationPrefs(wallet, prefs).catch(() => {});
  };

  const handleSignOut = async () => {
    await identity.signOut();
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
    router.replace("/");
  };

  return (
    <ScreenProfile
      avatar={app.avatar}
      streak={app.streak}
      personalBest={app.personalBest}
      points={app.points}
      userEmail={app.userEmail}
      walletAddress={identity.walletAddress ?? undefined}
      earnedBadgeIds={earnedBadgeIds}
      notificationPrefs={notificationPrefs}
      onUpdateNotificationPrefs={handleUpdatePrefs}
      onUpdateAvatar={app.updateUserAvatar}
      onOpenStreakShare={() => app.openShareSheet("streak")}
      onSignOut={handleSignOut}
    />
  );
}
