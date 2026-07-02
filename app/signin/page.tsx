"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import ScreenAuth from "@/src/components/ScreenAuth";
import LoadingSplash from "@/src/components/LoadingSplash";

export default function SignInPage() {
  const identity = useIdentity();
  const app = useAppState();
  const router = useRouter();

  // Once authenticated, route onward (wallet/profile resolution gates it).
  useEffect(() => {
    if (!identity.isAuthenticated) return;
    if (app.profileStatus === "ready") router.replace("/play");
    else if (app.profileStatus === "none") router.replace("/onboarding/identity");
    // 'loading' → wallet/profile still resolving; show splash below.
  }, [identity.isAuthenticated, app.profileStatus, router]);

  // After sign-in we hold the universal splash through wallet + profile resolve.
  if (identity.isAuthenticated) return <LoadingSplash />;

  return <ScreenAuth temporaryPick={null} />;
}
