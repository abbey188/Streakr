# Streakr — Code Sweep Log

A running log of optimization / issues-sweep passes over the codebase. Newest first.
Each pass records what was **fixed**, what was **verified healthy**, and what was
**noted but deliberately left open** (with the reasoning, so future passes don't
re-litigate it).

---

## Pass 1 — 5 July 2026 (semi-deep, pre-notifications)

Scope: data layer (TxLINE client/sync/normalize/provider), DB queries + resolution
+ live-notify, client state + polling, API routes/auth.

### ✅ Fixed & deployed

- **Background tabs no longer poll** (`705f346`). The two always-on pollers —
  fixtures (30s, `lib/state/app-state.tsx`) and the inbox unread badge (60s,
  `app/(app)/layout.tsx`) — ran forever for every signed-in user, even in
  hidden/backgrounded tabs. Both now **skip fetches while `document.hidden`** and
  **refresh immediately on refocus** (`visibilitychange`). Cuts idle server/DB load
  and client battery; the saving scales with user count.
- **Toast timer bug** (`705f346`). `triggerToast` shared a single untracked
  `setTimeout`, so a second toast inherited the first's countdown and vanished
  early. Now tracked in a ref and reset per toast.
- **Removed dead `getFixtures` fan-out** (this pass). The `TxlineProvider.getFixtures()`
  method (real + mock + interface) was never called — the only live provider use is
  single-match `getMatchDetail`; the fixtures LIST is served from Neon
  (`lib/db/queries.getFixtures`). The dead real-provider version fanned a scores
  call out to **all ~92 tournament fixtures** — a latent footgun if ever re-wired.
  Deleted the method, its `fixturesCache`, and the now-unused `Fixture` import;
  kept `getRawFixtures` (used by `getMatchDetail`).

### 🟢 Verified healthy (no action needed)

- **No N+1 in the hot path.** The user-facing fixtures list is one clean 3-table
  join (~48 knockout rows) in `getFixtures`. `/api/fixtures` does no per-fixture work.
- **Sync is window-scoped.** The frequent cron (`syncLiveFixtures`) only enriches
  matches near "now" (−4h…+45m) plus a bounded "stuck fixture" safety net — never
  the whole tournament. The slow full pull (`syncFixtures`) is seed/daily only.
- **Notifications are set-based.** `live-notify` uses `INSERT…SELECT` with in-query
  prefs filtering + `NOT EXISTS`/`ON CONFLICT` dedup → constant query count
  regardless of user count. Backed by the `notifications_live_dedup` partial index.
- **Resolution loops are cron-only** on small volumes (dozens of fixtures, a few
  groups). Acceptable; not user-facing.
- **Terminal-status guard** — a `finished` fixture can never regress to live/upcoming
  on a later bad derivation (`upsertFixtures` CASE guards). Good safety design.
- **Only one steady global poller cadence** (fixtures 30s + unread 60s); the
  match-detail 10s poll is scoped to an open live match and cleaned up on close.

### 🟡 Noted but left open (decide later)

1. **`/api/fixtures?wallet=` trusts the query param.** Passing another user's wallet
   reveals their per-match A/B picks. **Low severity** (picks aren't secrets) and
   locking it down would add a Privy token-verify to *every* 30s poll — a real
   perf/privacy trade. Left as a product decision. Touch point:
   `app/api/fixtures/route.ts` (would use `authWallet`/`getAuthedWallet`).
2. **Kickoff reminders notify every non-picker, per match.** `live-notify`'s
   "Kickoff soon" insert targets all users without a pick for each imminent knockout
   match (deduped once per user+match). Correct today; at scale it's a lot of pings.
   Revisit when tuning notification volume. Touch point: `lib/db/live-notify.ts`.
3. **App-state context value isn't memoized.** Considered and skipped: `value`
   depends on `fixtures`, which changes every poll, so memoization wouldn't prevent
   the re-renders. Real fix would be splitting contexts — a bigger refactor not
   justified at current app size.

### Pre-existing, out of scope

- `src/components/AvatarRenderer.tsx` has motion/react `Variants` type errors
  (string `ease` vs `Easing`). Long-standing; `next build` tolerates them. Not
  touched this pass.
