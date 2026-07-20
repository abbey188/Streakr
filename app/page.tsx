"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import ScreenLanding from "@/src/components/ScreenLanding";

/**
 * Entry route. Shows the branded landing for new/signed-out visitors, and
 * routes authenticated users to the right place as soon as Privy resolves:
 *   profile ready → /play   |   no profile → /onboarding/identity
 */
export default function RootPage() {
  const identity = useIdentity();
  const app = useAppState();
  const router = useRouter();

  // Early redirect for authenticated users (don't make them wait the full
  // landing animation once their session is restored).
  useEffect(() => {
    if (identity.isLoading || !identity.isAuthenticated) return;
    if (app.profileStatus === "ready") router.replace("/play");
    else if (app.profileStatus === "none") router.replace("/onboarding/identity");
    // New user: no embedded wallet yet (it provisions in the background). Route
    // to onboarding NOW so they build their mascot during provisioning rather
    // than waiting on a splash. A returning user already has an embedded wallet
    // (just rehydrating) — hold and let profile resolve, so we don't flash it.
    else if (!identity.walletAddress && !identity.hasEmbeddedWallet) router.replace("/onboarding/identity");
  }, [identity.isLoading, identity.isAuthenticated, identity.walletAddress, identity.hasEmbeddedWallet, app.profileStatus, router]);

  return (
    <ScreenLanding
      onTimeout={() => {
        // Brand moment finished. Route by session state; /signin self-corrects
        // if a slow-restoring session turns out to be authenticated.
        if (identity.isAuthenticated) {
          if (app.profileStatus === "ready") router.replace("/play");
          else if (app.profileStatus === "none") router.replace("/onboarding/identity");
          else if (!identity.walletAddress && !identity.hasEmbeddedWallet) router.replace("/onboarding/identity");
          else router.replace("/signin");
        } else {
          router.push("/signin");
        }
      }}
      onSkipToHome={() => router.push("/play")}
    />
  );
}
