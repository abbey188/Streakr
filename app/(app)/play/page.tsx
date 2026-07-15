"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import { fetchGlobalLeaderboard, type GlobalLeaderboardEntry } from "@/lib/api/client";
import { getCached, setCached } from "@/lib/state/cache";
import ScreenHome from "@/src/components/ScreenHome";
import ScreenTour from "@/src/components/ScreenTour";

export default function PlayPage() {
  const app = useAppState();
  const identity = useIdentity();
  const router = useRouter();
  // Seed from the last-good cache so returning to Play shows the board instantly
  // (no empty flash), then refresh in the background.
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardEntry[]>(
    () => getCached<GlobalLeaderboardEntry[]>("globalLeaderboard") ?? []
  );

  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    let cancelled = false;
    const load = () =>
      fetchGlobalLeaderboard(wallet)
        .then((rows) => { if (!cancelled) { setGlobalLeaderboard(rows); setCached("globalLeaderboard", rows); } })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000); // keep the leaderboard live while open
    return () => { cancelled = true; clearInterval(t); };
  }, [identity.walletAddress]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <ScreenHome
        avatar={app.avatar}
        streak={app.streak}
        personalBest={app.personalBest}
        points={app.points}
        fixtures={app.fixtures}
        globalLeaderboard={globalLeaderboard}
        walletAddress={identity.walletAddress ?? undefined}
        onMakePick={app.makePick}
        onOpenProfile={() => router.push("/profile")}
        onSeePastMatches={() => router.push("/past")}
      />
      {app.showTour && <ScreenTour onDismiss={app.dismissTour} />}
    </div>
  );
}
