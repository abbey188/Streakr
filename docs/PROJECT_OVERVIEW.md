# Streakr — Project Overview, Build Approach & Roadmap

_A living record of what Streakr is, how we build it, what's shipped, and what's next._
Last updated: 4 July 2026.

---

## 1. What Streakr is

Streakr is a **World Cup 2026 knockout-pick streak game**. Players predict who
advances in each knockout tie (winner after ET/penalties — no draws), building a
**streak** of correct picks. Points are permanent (banked `10 × streak length`);
the streak is the live run that resets on a miss. Per-round **Champions** are
crowned (most correct picks that round), and the tournament culminates in an
overall champion.

- **Stack:** Next.js 15 (App Router, React 19), Tailwind v4, Privy whitelabel
  auth (email / Google / Apple + Solana embedded wallet as identity), Neon
  Postgres, live match data via **TxLINE/TxODDS**, deployed on Vercel.
- **Live data:** an external cron (cron-job.org) hits `/api/cron/sync-live` every
  minute → pulls fresh scores → updates fixtures, fires notifications, resolves
  picks. Near-real-time without a persistent socket.

---

## 2. How we approach builds (the method)

This is the discipline that's kept a **live app with real users** stable while
shipping fast:

1. **Diagnose before building.** For every issue we read the actual code + query
   real prod data to find the true root cause before writing a fix. (E.g. the
   "champions weren't crowned" turned out to be a *surfacing* gap, not a crowning
   bug — the data was already correct.)
2. **Stage risky work; keep each increment verifiable.** Big changes ship in safe
   stages (e.g. auth: token layer → backfill → verify-only bake → enforce; picks:
   server rule → UI). Each stage is inert or additive on its own.
3. **Flag-gate + reversible.** Behaviour-changing work sits behind a flag
   (`AUTH_ENFORCED`) or a conservative default, so it can be turned on/off without
   a redeploy and reverted instantly.
4. **Typecheck + build-verify every deploy.** `tsc --noEmit` before pushing; after
   each push we confirm the Vercel build reaches **Ready** (not Error) before
   moving on. Nothing is "done" until it's green in prod.
5. **Fail-safe by design.** Guards fail *closed* where fairness/security matters
   (cron auth, pick window) and *soft* where availability matters (announcements,
   debug writes wrapped in try/catch so they can never break the main path).
6. **Terminal states & idempotency.** Finished matches can't be un-finished;
   crownings/broadcasts fire once; migrations use `if not exists`. Re-runs are safe.
7. **Surface, then act.** UX work is logged in `docs/ux/ISSUES.md` (diagnosed +
   aligned) before any front-facing change, per the "run UI changes by the owner"
   rule.

### Deploy & environment conventions (gotchas)
- **Deploys** are git-push → Vercel builds on `main`. The CLI is only for
  polling/env (`VERCEL_TOKEN`, scope `abbey188s-projects`).
- **TLS interception** on the dev machine ⇒ Node/npm/vercel commands need
  `NODE_OPTIONS=--use-system-ca`; git uses `http.sslBackend=schannel`.
- **`.env.local` is blocked** on this machine (Controlled Folder Access) → we use
  `.env` (gitignored); scripts read `.env`.
- Never share `.next` between `next dev` and `next build`.
- `next.config.ts` has `ignoreBuildErrors`/`ignoreDuringBuilds` on (pre-existing
  framer-motion `ease` type mismatches in AvatarRenderer). We typecheck manually
  before each deploy instead.

---

## 3. What we've shipped

### Reliability (the lifeblood)
- **Finished-match settlement fix.** TxLINE's 1 Jul 2026 release sets
  `StatusId = 100` on `game_finalised`; our derivation took `max(StatusId)`, hit
  the unmapped 100, and stranded finished matches as "upcoming" (unpickable-fix +
  unresolved picks). Fixed to treat 100 / `game_finalised` as finalised, with the
  winning method from the deepest real phase.
- **Fail-safe pipeline guards:** `finished` is terminal in the DB (a sync can't
  un-finish a match); a safety-net sweep re-checks any past-kickoff unfinished
  knockout every cycle; picks freeze by kick-off time as well as status.
- **Action-driven match timeline:** scorer/player names, penalty outcomes,
  confirmed-only (VAR-safe) — the SSE-ready event model.

### Security
- **Wave 1 (shipped):** gated the heavy endpoints (`/api/txline/sync`,
  `/api/resolve`) behind `CRON_SECRET`; made the cron **fail closed**; added
  baseline security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy).
- **Wave 2 — auth keystone (in progress):** the app trusted a client-supplied
  wallet. We added Privy **server-side token verification** (`@privy-io/server-auth`),
  a `privy_user_id` mapping (all 22 users backfilled), a client token layer, and a
  **verify-only bake** (logs proof it works without rejecting anyone). Graceful
  401 retry shipped. **Enforcement** (`AUTH_ENFORCED=true`) + closing the
  email-disclosure leak is the final step, once the bake is clean.
- **Wave 3 — parked (tail):** rate limiting, enforced CSP, CI typecheck gate.
  Low severity; slated before the social feed opens user content.

### UX features (audit issues 1–5)
- **#1 Round Champions surfaced:** each round in the stepper is tappable → its
  standings + crowned champion; crowning now broadcasts to *all* round-pickers
  (not just the winner). R32's champion (@Kofo) was broadcast retroactively.
- **#2 Tap a live match → stats overlay** on Play (reuses `ScreenMatchDetail`);
  Hub stays the history browser.
- **#3 Announcement pipeline:** a backend-drivable, dismissible glance strip
  (`announcements` table → `/api/announcements` → `AnnouncementBanner`); post one
  with a single INSERT; scheduling/expiry via `starts_at`/`ends_at`.
- **#4b** removed the static "Pro Streak" tip card (tips now live in announcements);
  **#4a** documented that "10 points / 0 streak" is correct (permanent points vs
  live streak).
- **#5 Pick-until-first-event (major model change):** picks stay open past
  kick-off — while the match is **0-0, 11-v-11, first half/HT** — and close on the
  first confirmed **goal**, a **red card**, or **second-half kickoff**. Enforced
  server-side against a **fresh live check** (anti-exploit); live cards render 4
  states (open CTA / open+change / locked / closed·reason) with graceful revert.
- **Orange-ring affordance** on the knockout stepper spheres.

### Other
- Logo PNG for the X profile; **legal drafts** (Privacy, Terms, Tournament Rules
  template) written and parked with an enablement checklist.

---

## 4. In progress / held
- **R16 announcement** — copy final ("⚽ WC R16 is here — picks don't stop at
  kickoff"), will post to both the strip and every user's Inbox, auto-expiring
  ~4 days. **Held** until the owner says "send it."
- **Auth enforcement** — flip `AUTH_ENFORCED`, drop the `auth_debug` scaffolding,
  close the email leak. Planned after the bake accumulates across real users.

---

## 5. Roadmap (what we plan to ship)

**Near-term (high value):**
- Custom domain (unblocks real contact emails for legal).
- Legal go-live: fill config, footer + signup consent + 18+ gate, deploy
  `/privacy` `/terms`; claims audit; account-deletion flow.
- Security Wave 3 (rate limiting, CSP) before the social feed.
- Issue 1 C+D: champion shown on the card; overall "The Streakr" champion at the Final.

**Product / growth:**
- **Web Push** notifications ("your pick just scored") — reuses the notify
  pipeline; biggest retention lever.
- **SSE live feed** (the timeline is the foundation) + **Reddit-style discussion
  threads** under match moments (needs auth + moderation).
- Retention mechanics: streak-freeze/comeback, predict-the-scorer, group
  trash-talk, seasons/resets.

**Monetization:** sponsored prize tournaments (Official Rules + anti-farming), ads
(privacy + consent), cosmetics (streak restores).

**Hygiene / future:** dependency upgrade pass (Privy + Solana majors, post-auth);
use `GameState` to hide cancelled matches; on-chain provable settlement
(TxODDS `validate_stat_v2`).

---

## 6. Data model additions (this cycle)
- `users.privy_user_id` — Privy DID ↔ wallet mapping for server auth (indexed, unique).
- `fixtures.pick_open` + `pick_close_reason` — the Issue 5 pick window, computed each sync.
- `announcements` — backend-drivable glance strip (kind/priority/audience/starts_at/ends_at/active).
- `round_champions` — per-round + global champions (idempotent) — powers Issue 1.
- `auth_debug` — temporary bake diagnostics (removed at enforcement).

## 7. Where the details live
- UX issues (diagnosis + specs): `docs/ux/ISSUES.md`
- Auth rollout plan: `docs/security/WAVE2_AUTH_PLAN.md`
- Legal enablement: `docs/legal/ENABLEMENT.md` + templates
