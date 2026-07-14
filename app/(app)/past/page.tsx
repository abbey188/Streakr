"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state/app-state";
import ScreenLiveScores from "@/src/components/ScreenLiveScores";

/** "See past matches" — the finished-match browser, moved off the (now
 *  live-only) Hub to one tap from your picks on Play. */
export default function PastMatchesPage() {
  const app = useAppState();
  const router = useRouter();
  return (
    <ScreenLiveScores
      fixtures={app.fixtures}
      onlyFinished
      title="Past matches"
      onBack={() => router.back()}
      onOpenMatch={(fixtureId) => router.push(`/hub/${fixtureId}`)}
    />
  );
}
