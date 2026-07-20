"use client";

import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import { useWallets, useCreateWallet } from "@privy-io/react-auth/solana";
import { useCallback, useEffect, useRef } from "react";
import type { EmailOtpStage, OAuthProvider, UseIdentity } from "./types";

/**
 * Privy adapter for the vendor-neutral Identity contract (./types.ts).
 *
 * This is the ONLY file in the app that imports Privy. Everything else talks
 * to the returned UseIdentity shape, so changing auth vendors means rewriting
 * just this file + the provider.
 */

// Privy stores email under several shapes depending on the login method.
function extractEmail(user: ReturnType<typeof usePrivy>["user"]): string | null {
  if (!user) return null;
  return (
    user.email?.address ??
    user.google?.email ??
    user.apple?.email ??
    null
  );
}

function mapEmailStage(status: string | undefined): EmailOtpStage {
  switch (status) {
    case "sending-code":
      return "sending";
    case "awaiting-code-input":
      return "awaiting-code";
    case "submitting-code":
      return "verifying";
    default:
      return "idle";
  }
}

export function usePrivyIdentity(): UseIdentity {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets(); // Solana embedded wallet(s)
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();

  // Whitelabel (headless) login does NOT auto-create embedded wallets — Privy
  // only auto-creates for its own modal (per Privy's "Automatic wallet creation"
  // docs: it skips loginWithCode / useLoginWithOAuth). So, per their manual-
  // creation best practice, we create the Solana wallet ourselves right after
  // authentication. The /solana useCreateWallet hook takes no args and resolves
  // a promise (the onSuccess/onError callback form is the main-package hook).
  const { createWallet } = useCreateWallet();
  const creatingRef = useRef(false);

  const walletAddress = wallets[0]?.address ?? null;
  // A returning user's embedded wallet is listed on their Privy account the moment
  // they authenticate — before `useWallets()` finishes rehydrating the address.
  // That lets routing tell "wallet still loading" (returning) from "no wallet yet"
  // (brand new) and stop flashing the onboarding screen on a returning sign-in.
  // The only wallet a Streakr user ever has is the Privy embedded one (there's no
  // external-wallet linking flow), so any linked account of type "wallet" is it.
  const hasEmbeddedWallet =
    wallets.length > 0 ||
    Boolean(user?.linkedAccounts?.some((a) => a.type === "wallet"));

  useEffect(() => {
    if (!ready || !authenticated) {
      creatingRef.current = false;
      return;
    }
    // Already have a wallet, or a create is already in flight → do nothing.
    // (Privy also guards server-side: createAdditional defaults to false, so a
    // user with an existing wallet won't get a duplicate.)
    if (wallets.length > 0 || creatingRef.current) return;
    creatingRef.current = true;
    createWallet()
      .catch((error) => {
        // Allow a retry on the next state change; surface for debugging.
        creatingRef.current = false;
        // eslint-disable-next-line no-console
        console.error("[Streakr] Solana wallet creation failed:", error);
      });
  }, [ready, authenticated, wallets.length, createWallet]);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      await initOAuth({ provider });
    },
    [initOAuth]
  );

  const sendEmailCode = useCallback(
    async (email: string) => {
      await sendCode({ email });
    },
    [sendCode]
  );

  const verifyEmailCode = useCallback(
    async (code: string) => {
      await loginWithCode({ code });
    },
    [loginWithCode]
  );

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  // Never throw from token retrieval — API calls must still go out if it fails.
  const safeGetAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      return await getAccessToken();
    } catch {
      return null;
    }
  }, [getAccessToken]);

  return {
    isLoading: !ready,
    isAuthenticated: authenticated,
    walletAddress,
    hasEmbeddedWallet,
    email: extractEmail(user),
    signInWithOAuth,
    sendEmailCode,
    verifyEmailCode,
    emailOtpStage: mapEmailStage(emailState?.status),
    oauthLoading,
    signOut,
    getAccessToken: safeGetAccessToken,
  };
}
