"use client";

import { useState, useEffect } from "react";
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
  const [saving, setSaving] = useState(false);

  // Guard: must be authenticated; if a profile already exists, skip ahead.
  useEffect(() => {
    if (identity.isLoading) return;
    if (!identity.isAuthenticated) {
      router.replace("/");
    } else if (app.profileStatus === "ready") {
      router.replace("/play");
    }
  }, [identity.isLoading, identity.isAuthenticated, app.profileStatus, router]);

  if (
    saving ||
    identity.isLoading ||
    !identity.isAuthenticated ||
    app.profileStatus === "ready" ||
    app.profileStatus === "loading" // wallet still creating
  ) {
    return <LoadingSplash label={saving ? "Locking in your identity…" : undefined} />;
  }

  const handleConfirm = async (config: AvatarConfig) => {
    setSaving(true);
    await app.createProfile(config);
    router.push("/play");
  };

  return <ScreenIdentity onConfirm={handleConfirm} />;
}
