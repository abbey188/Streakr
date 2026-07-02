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
  return <ScreenMatchDetail fixtureId={fixtureId} onBack={() => router.push("/hub")} />;
}
