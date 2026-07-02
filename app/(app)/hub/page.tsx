"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state/app-state";
import ScreenLiveScores from "@/src/components/ScreenLiveScores";

export default function HubPage() {
  const app = useAppState();
  const router = useRouter();
  return (
    <ScreenLiveScores
      fixtures={app.fixtures}
      onOpenMatch={(fixtureId) => router.push(`/hub/${fixtureId}`)}
    />
  );
}
