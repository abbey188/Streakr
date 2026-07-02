# Streakr — Vercel deploy checklist

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Copy these from `.env.local` (Production + Preview):

```
# TxLINE (server-only — never expose to browser)
TXLINE_API_TOKEN=...
TXLINE_API_BASE_URL=https://txline.txodds.com
TXLINE_WORLD_CUP_COMPETITION_ID=72
TXLINE_SUBSCRIBE_TXSIG=...            # only needed to re-activate a token
TXLINE_DEVELOPER_WALLET_PRIVATE_KEY=...# only needed to re-activate a token

# Database
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require

# Auth (public)
NEXT_PUBLIC_PRIVY_APP_ID=...

# Cron protection — already generated into .env.local; Vercel Cron sends it
CRON_SECRET=<random-hex>
```

**Fast path:** after `vercel link` (section 2), push everything from `.env.local`
in one shot instead of hand-entering each:

```bash
NODE_OPTIONS=--use-system-ca bash scripts/push-vercel-env.sh              # production
NODE_OPTIONS=--use-system-ca bash scripts/push-vercel-env.sh .env.local preview
```

## 2. Deploy

> On this machine the corporate network intercepts TLS, so **prefix every
> `vercel` command with `NODE_OPTIONS=--use-system-ca`** (otherwise you get
> "unable to verify the first certificate"). Not needed on a normal network.

```bash
# Vercel CLI is already installed (v53). Log in (interactive — email/browser):
NODE_OPTIONS=--use-system-ca npx vercel login

# Link this folder to a Vercel project (interactive — pick scope + project):
NODE_OPTIONS=--use-system-ca npx vercel link

# Add the env vars from section 1 (dashboard is easiest for secrets), then:
NODE_OPTIONS=--use-system-ca npx vercel --prod   # → live URL
```

The production build is verified green (`npm run build` succeeds; 31 routes incl.
`/hub/[fixtureId]` and all API routes). Tip: run `next build` with the dev server
**stopped** — sharing the `.next` dir with `next dev` causes a spurious
"Cannot find module for page" error.

## 3. Keeping data fresh — the sync trigger

`/api/cron/sync-live` pulls live/recent matches, fires goal + kickoff
notifications, resolves picks, and keeps Neon warm. Note: the match you're
*watching* already polls TxLINE directly every 10s, so this trigger drives
results / notifications / leaderboards — a 2–5 min cadence is plenty.

**On Vercel Hobby**, Vercel's own cron only runs once/day (that's the
`0 5 * * *` daily fallback in `vercel.json`). Drive the frequent sync from
**cron-job.org**:

- URL: `https://<your-app>.vercel.app/api/cron/sync-live`
- Method: **POST**
- Schedule: every **1–2 min**
- Header: `Authorization: Bearer <CRON_SECRET>`  (same value as the Vercel env)
- Request timeout: bump to ~90s (the sync can take a few seconds)

If you upgrade to **Pro**, just change the `vercel.json` schedule to `*/2 * * * *`
and delete the cron-job.org job.

## 4. Full backfill (occasional, not a cron)

The full history sync (`POST /api/txline/sync`) takes ~2 min — longer than a
serverless request window. Run it manually when needed (seed / schema change):

```bash
curl -X POST https://<domain>/api/txline/sync
# or locally against the prod DB with NODE_OPTIONS=--use-system-ca
```

The DB is already seeded; the every-2-min light sync keeps it current from here.

## 5. Post-deploy smoke test

- Landing (2s) → signin → onboarding → play
- Trigger `/api/cron/sync-live` once, confirm `{ ok: true }`
- Check a live/finished match in Hub, make a pick, confirm it resolves
