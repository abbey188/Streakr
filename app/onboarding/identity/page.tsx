"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AvatarConfig } from "@/src/types";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import ScreenIdentity from "@/src/components/ScreenIdentity";
import LoadingSplash from "@/src/components/LoadingSplash";

export default function OnboardingIdentityPage() {
  const identity = useIdentity();
  const app = useAppState();
  const router = useRouter();
  // The chosen mascot, held until the embedded wallet is ready to persist against.
  const [pending, setPending] = useState<AvatarConfig | null>(null);
  const savingRef = useRef(false);

  // Guard: must be authenticated. A returning user (profile already exists) skips
  // ahead — but never while a save is in flight.
  useEffect(() => {
    if (identity.isLoading) return;
    if (!identity.isAuthenticated) router.replace("/");
    else if (app.profileStatus === "ready" && !pending) router.replace("/play");
  }, [identity.isLoading, identity.isAuthenticated, app.profileStatus, pending, router]);

  // The mascot builder is shown DURING wallet provisioning, so at confirm the
  // embedded wallet may not exist yet. Persist the instant it lands — by the time
  // someone has built their guy, it's almost always already done.
  useEffect(() => {
    if (!pending || !identity.walletAddress || savingRef.current) return;
    savingRef.current = true;
    (async () => {
      try {
        await app.createProfile(pending);
        router.push("/play");
      } catch {
        // Username was taken in the race between the builder's check and save
        // (rare — the builder blocks taken names up front). Drop back so they
        // can pick another instead of getting stuck.
        savingRef.current = false;
        setPending(null);
        app.triggerToast("That username was just taken — pick another.");
      }
    })();
  }, [pending, identity.walletAddress, app, router]);

  // Splash only when we genuinely can't show the builder: session still resolving,
  // not signed in, a save is committing, or a returning user bouncing to /play.
  if (identity.isLoading || !identity.isAuthenticated || pending || app.profileStatus === "ready") {
    return <LoadingSplash label={pending ? "Locking in your identity…" : undefined} />;
  }

  return <ScreenIdentity onConfirm={setPending} />;
}
