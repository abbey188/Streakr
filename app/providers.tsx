"use client";

import { ReactNode } from "react";
import { IdentityProvider } from "@/lib/identity/context";
import { AppStateProvider } from "@/lib/state/app-state";

/**
 * App-wide client providers. IdentityProvider (auth, vendor-neutral) wraps
 * AppStateProvider (shared game state), so every route can read both.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <IdentityProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </IdentityProvider>
  );
}
