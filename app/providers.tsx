"use client";

import { ReactNode, useEffect } from "react";
import { IdentityProvider } from "@/lib/identity/context";
import { AppStateProvider } from "@/lib/state/app-state";
import { ensureServiceWorker } from "@/lib/push/client";

/**
 * App-wide client providers. IdentityProvider (auth, vendor-neutral) wraps
 * AppStateProvider (shared game state), so every route can read both.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // Register the (caching-free) service worker on load so browsers can offer
  // "Install app" — getting Streakr onto home screens on Android as well as iOS.
  useEffect(() => { void ensureServiceWorker(); }, []);

  return (
    <IdentityProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </IdentityProvider>
  );
}
