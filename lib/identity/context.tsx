"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { usePrivyIdentity } from "./privyAdapter";
import { setAuthTokenGetter } from "@/lib/api/client";
import type { UseIdentity } from "./types";

/**
 * Identity context — the app's single source of auth truth.
 *
 * It is ALWAYS present (even before an App ID is configured), so any component
 * can call useIdentity() without crashing. When NEXT_PUBLIC_PRIVY_APP_ID is
 * set, real Privy state flows in through PrivyBridge; otherwise a stub keeps
 * the app (and the dev sandbox) running with auth simply unavailable.
 *
 * Because components consume THIS context and never Privy directly, swapping
 * vendors means changing only privyAdapter.ts + this file.
 */

const notConfigured = async () => {
  throw new Error(
    "Auth is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local."
  );
};

const STUB_IDENTITY: UseIdentity = {
  isLoading: false,
  isAuthenticated: false,
  walletAddress: null,
  email: null,
  signInWithOAuth: notConfigured,
  sendEmailCode: notConfigured,
  verifyEmailCode: notConfigured,
  emailOtpStage: "idle",
  oauthLoading: false,
  signOut: async () => {},
  getAccessToken: async () => null,
};

const IdentityContext = createContext<UseIdentity>(STUB_IDENTITY);

/** The vendor-neutral hook every component uses. */
export function useIdentity(): UseIdentity {
  return useContext(IdentityContext);
}

/** Lives inside PrivyProvider; pipes live Privy state into the context. */
function PrivyBridge({ children }: { children: ReactNode }) {
  const identity = usePrivyIdentity();
  // Give the API client a way to fetch the current access token, so every
  // request carries the Bearer header. Inert until server-side auth is enforced.
  useEffect(() => {
    setAuthTokenGetter(identity.getAccessToken);
    return () => setAuthTokenGetter(null);
  }, [identity.getAccessToken]);
  return (
    <IdentityContext.Provider value={identity}>
      {children}
    </IdentityContext.Provider>
  );
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

  if (!appId) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[Streakr] NEXT_PUBLIC_PRIVY_APP_ID not set — auth disabled. Add it to .env.local."
      );
    }
    return (
      <IdentityContext.Provider value={STUB_IDENTITY}>
        {children}
      </IdentityContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "apple"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#FF4E00",
        },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}
