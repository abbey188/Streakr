"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import { fetchGlobalLeaderboard, type GlobalLeaderboardEntry } from "@/lib/api/client";
import ScreenHome from "@/src/components/ScreenHome";
import ScreenTour from "@/src/components/ScreenTour";

export default function PlayPage() {
  const app = useAppState();
  const identity = useIdentity();
  const router = useRouter();
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);

  useEffect(() => {
    if (!identity.walletAddress) return;
    fetchGlobalLeaderboard(identity.walletAddress).then(setGlobalLeaderboard).catch(() => {});
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
      />
      {app.showTour && <ScreenTour onDismiss={app.dismissTour} />}
    </div>
  );
}
