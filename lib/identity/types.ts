/**
 * Vendor-neutral identity contract.
 *
 * The whole app (App.tsx flow, API calls) depends on THIS shape — never on
 * Privy (or Phantom, or anything else) directly. Swapping the auth vendor is
 * a single-adapter change: re-implement useIdentity() and the provider, and
 * nothing else in the app moves. Mirrors the swappable TxLINE pattern.
 */

export type OAuthProvider = "google" | "apple";

/** Where the email-OTP flow currently is, for driving ScreenAuth's UI. */
export type EmailOtpStage = "idle" | "sending" | "awaiting-code" | "verifying";

export interface Identity {
  /** SDK still initialising / silently restoring a session. Gate the app on this. */
  isLoading: boolean;
  /** A valid session exists (returning user → straight to Home). */
  isAuthenticated: boolean;
  /** Solana wallet address — the stable identity key used everywhere. */
  walletAddress: string | null;
  /**
   * True once the user has a Privy embedded wallet linked. A returning user has
   * it immediately on auth (even before `walletAddress` finishes rehydrating); a
   * brand-new user only gets it after provisioning. Distinguishes "wallet
   * rehydrating" from "genuinely new" — so a returning sign-in never flashes the
   * onboarding screen while the wallet loads.
   */
  hasEmbeddedWallet: boolean;
  /** Email if the user signed in with (or linked) one; else null. */
  email: string | null;
}

export interface IdentityActions {
  /** Start Google/Apple OAuth (redirect flow). */
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  /** Email OTP step 1 — send the code. */
  sendEmailCode: (email: string) => Promise<void>;
  /** Email OTP step 2 — verify the code and complete sign-in. */
  verifyEmailCode: (code: string) => Promise<void>;
  /** Current email-OTP stage for UI feedback. */
  emailOtpStage: EmailOtpStage;
  /** Loading flag for the OAuth redirect kick-off. */
  oauthLoading: boolean;
  /** End the session. */
  signOut: () => Promise<void>;
  /**
   * Current access token for authenticating API calls server-side. Returns null
   * when unauthenticated or not yet ready. The API client attaches it as a
   * Bearer token; server-side auth verifies it (Wave 2).
   */
  getAccessToken: () => Promise<string | null>;
}

export type UseIdentity = Identity & IdentityActions;
