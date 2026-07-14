"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state/app-state";
import LiveFeed from "@/src/components/LiveFeed";

export default function HubPage() {
  const app = useAppState();
  const router = useRouter();
  return (
    <LiveFeed
      fixtures={app.fixtures}
      feed={app.feed}
      onOpenMatch={(fixtureId) => router.push(`/hub/${fixtureId}`)}
    />
  );
}
