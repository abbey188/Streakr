/**
 * Single source of truth for the details that appear across the legal pages.
 *
 * Streakr is a FREE game with no cash prizes, no paid entry, and no purchases —
 * the documents are written to match that reality. Everything in /privacy and
 * /terms is drawn concretely from the real product + stack.
 *
 * NOTE: These documents are strong, tailored starting points — NOT a substitute
 * for review by a qualified lawyer before or shortly after going fully public.
 */
export const LEGAL = {
  /** Public product name. */
  appName: "Streakr",

  /** The entity/individual that operates Streakr. */
  operator: "Streakr",

  /** Monitored contact addresses for support + privacy requests. */
  contactEmail: "support@streakr.click",
  privacyEmail: "privacy@streakr.click",

  /** Country/state whose law governs the Terms + hosts disputes. */
  governingLaw: "Nigeria",

  /** Free game, no prizes ⇒ a standard app minimum age. */
  minAge: 13,

  /** Keep these current whenever the documents change. */
  effectiveDate: "5 July 2026",
  lastUpdated: "5 July 2026",

  /**
   * Third parties that process user data on Streakr's behalf. Keep in sync with
   * reality — regulators expect this list to be accurate and complete.
   */
  subProcessors: [
    { name: "Privy", purpose: "Authentication, email login, embedded wallet", url: "https://privy.io/privacy" },
    { name: "Neon", purpose: "PostgreSQL database hosting (account + gameplay data)", url: "https://neon.tech/privacy-policy" },
    { name: "Vercel", purpose: "Application hosting & delivery", url: "https://vercel.com/legal/privacy-policy" },
    { name: "TxODDS / TxLINE", purpose: "Live sports fixtures & scores", url: "https://www.txodds.com" },
    { name: "cron-job.org", purpose: "Scheduled data-sync triggers", url: "https://cron-job.org/en/privacy/" },
    { name: "Solana", purpose: "Public blockchain used for wallet identity", url: "https://solana.com/privacy-policy" },
  ],
} as const;
