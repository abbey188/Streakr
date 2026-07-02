"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSplash from "@/src/components/LoadingSplash";

/**
 * Invite-link landing (`/join?code=XYZ`). Stashes the code and forwards into the
 * app; app-state consumes it once the user is signed in + onboarded — so it works
 * whether the visitor is already a member or a brand-new signup who needs to
 * authenticate first. (Reads window.location to avoid the useSearchParams
 * Suspense requirement.)
 */
export default function JoinPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && code.trim()) {
      try {
        localStorage.setItem("streakr_invite", code.trim());
      } catch {
        /* storage unavailable — nothing else we can do */
      }
    }
    router.replace("/groups");
  }, [router]);

  return <LoadingSplash label="Opening your invite…" />;
}
