"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import ScreenMatchDetail from "@/src/components/ScreenMatchDetail";

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = use(params);
  const router = useRouter();
  // Flow back the way you came (Hub feed, "See past matches", a deep-link…),
  // not always to the Hub. Falls back to /hub if there's no history to pop.
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/hub");
  };
  return <ScreenMatchDetail fixtureId={fixtureId} onBack={onBack} />;
}
