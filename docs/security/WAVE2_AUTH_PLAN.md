# Wave 2 — Server-side auth keystone (staged rollout)

Goal: stop trusting the client-supplied `walletAddress`. Derive the caller's
wallet from a **verified Privy access token**. Staged + flag-gated + reversible,
so the live app (22 users today) is never at risk.

## Status
- [x] **Step 1 (inert, done):** `@privy-io/server-auth` installed; `lib/auth/server-auth.ts`
      helper written (imported nowhere); `privy_user_id` column added to
      `schema.sql` (applied only when `migrate.mjs` runs). Everything typecheck-clean.
- [ ] Step 2 — client sends token (safe)
- [ ] Step 3 — run migration + backfill the 22 existing users
- [ ] Step 4 — migrate routes behind `AUTH_ENFORCED` (bake OFF, then flip)
- [ ] Step 5 — enforce + fix #2 (email disclosure)

## Env vars to add (Vercel + local `.env`)
| Var | Where from | Notes |
|---|---|---|
| `PRIVY_APP_SECRET` | Privy dashboard → App settings | **server-only**, never `NEXT_PUBLIC_` |
| `PRIVY_APP_ID` | already have `NEXT_PUBLIC_PRIVY_APP_ID` | helper falls back to the public one |
| `AUTH_ENFORCED` | our flag | leave **unset/false** until Step 4 flip |

## Step 2 — client attaches the token (cannot break anything)
- Add `getAccessToken()` to the `UseIdentity` interface + `privyAdapter.ts`
  (Privy exposes it). Stub returns `null`.
- In `lib/api/client.ts`, attach `Authorization: Bearer <token>` to every request.
  Server still ignores it → zero behavior change. Gate requests on the token
  being ready to avoid the load-time race.

## Step 3 — migration + backfill (22 users)
- Run `node --env-file=.env scripts/migrate.mjs` → adds `privy_user_id` (nullable).
- **Backfill:** one-shot script over all 22 users → look each wallet up in Privy →
  set `privy_user_id`. With only 22 users this fully removes the first-touch edge.
  (Lazy `bindPrivyUser` on first authed request is the fallback for anyone missed.)

## Step 4 — migrate routes (bake with flag OFF, then flip)
Order = highest value first. Each route: verify → use authed wallet; while
`AUTH_ENFORCED=false`, fall back to body wallet + opportunistically `bindPrivyUser`.

**Route classification**
| Class | Routes | Behavior |
|---|---|---|
| Public (no auth) | `GET /api/fixtures`, `/api/matches/[id]`, `/api/leaderboard/global`, `/api/groups/[id]/leaderboard`, `/api/groups/[id]/activity`, `/api/rounds/race`, `/api/badges` | stay open (wallet only hydrates *your* pick, optional) |
| Authed write | `POST /api/picks` → **first**, `POST /api/users` (signup), `PATCH /api/users/avatar`, `POST /api/groups`, `POST /api/groups/join`, `PATCH /api/me/notification-prefs` | require verified wallet |
| Authed read (own data) | `GET /api/me` (+ pre-signup resolve), `/api/me/notifications` (+`/unread`), `/api/me/badges`, `/api/me/groups-activity`, `POST /api/me/notifications` | require verified wallet; only return caller's own data |
| Cron/admin | `sync-live`, `txline/sync`, `resolve` | `CRON_SECRET` (Wave 1 — done) |

## Step 5 — enforce + close #2
- Set `AUTH_ENFORCED=true`. Routes now reject unverified callers.
- `GET /api/me` returns **email only for the caller's own row**; other users'
  data (leaderboards/activity) never includes email.

## Two decisions (locked)
1. **Signup ignores the client wallet** — take the Solana wallet straight from
   Privy (`resolveFromPrivy`). A user can never register as someone else's wallet.
2. **Bake OFF a few days** before flipping `AUTH_ENFORCED`, so backfill + the
   client token rollout settle across active users first.

## Rollback
Flip `AUTH_ENFORCED=false` (or revert a single route) → instant return to today's
behavior. Blast radius is always one route, always reversible.
