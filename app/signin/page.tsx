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

  // Once authenticated, route onward.
  useEffect(() => {
    if (!identity.isAuthenticated || identity.isLoading) return;
    if (app.profileStatus === "ready") router.replace("/play");
    else if (app.profileStatus === "none") router.replace("/onboarding/identity");
    // New user: the embedded wallet is still provisioning (returning users
    // already have one). Send them to onboarding NOW so they build their mascot
    // while it finishes in the background, instead of staring at a splash.
    else if (!identity.walletAddress) router.replace("/onboarding/identity");
  }, [identity.isAuthenticated, identity.isLoading, identity.walletAddress, app.profileStatus, router]);

  // After sign-in we hold the universal splash through wallet + profile resolve.
  if (identity.isAuthenticated) return <LoadingSplash />;

  return <ScreenAuth temporaryPick={null} />;
}
