# ADR 0001 — Live data: polling hybrid now, real-time ingestor later

- **Status:** Accepted
- **Date:** 2026-07-06
- **Context tags:** live feed (TxLINE/TxODDS), Vercel serverless, Neon, Web Push

## Context

Streakr is a World Cup knockout **pick game**. Live match data (TxLINE) drives the
score cards, goal/kickoff notifications, and pick resolution. Two facts frame the
decision:

- **The feed tier is real-time** (confirmed with TxLINE, 3 Jul 2026) — not the
  60-second-delayed option. So genuine real-time is achievable from the source.
- **The app is serverless (Vercel).** There is no always-on process; functions are
  short-lived (≤60s). The frequent sync is driven by an **external cron**
  (cron-job.org) hitting `/api/cron/sync-live`; the browser polls `/api/fixtures`.

Also recorded here: **`StatusId 100`** is a property of the `game_finalised` action
(per TxLINE's 3 Jul 2026 release — "all `action=game_finalised` will have
`statusId 100`"). Our derivation keys finalisation off the **action**, not a bare
100, which is correct. The `disconnected`-carrying-100 we observed is 100 leaking
onto a non-final action — a feed bug (see `docs/txline/FEED_LOG.md` A1), not
intended behaviour.

## Decision

**Keep optimized polling as the live-data backbone for now. Do NOT migrate to an
SSE ingestor during the tournament.** Adopt a real-time ingestor later as a
deliberate, isolated addition — not a rearchitecture.

## Rationale

What actually needs low latency in a pick game:

| Concern | Latency need | Handling |
|---|---|---|
| Pick correctness / resolution | none (resolves at match end) | polling/cron |
| Pick-window fairness (close on first goal) | real-time **at pick time only** | already does a **fresh live TxLINE check** in `getPickWindow` |
| Live score display | "feels live" (15–30s fine) | polling |
| Goal push notifications | nice-to-be-fast | polling/cron |

Key engineering facts:

1. **SSE → browser does nothing for notifications.** Push is generated
   server-side; it must fire with zero connected clients. So client streaming is
   only a *display* nicety — the least important surface.
2. **Real-time notifications require one always-on consumer** of the feed's SSE
   stream (write DB + `sendPush`). Vercel serverless can't hold that connection, so
   it is genuinely new infra.
3. The fairness-critical path (pick window) is **already** real-time-checked,
   independent of display polling.

Therefore real-time is a **valuable future upgrade**, not a correctness need.
Building an always-on component *during a live event* trades a working system for
incident risk.

## The target architecture (the "merge")

Layered, each piece doing what it's best at:

1. **One small always-on ingestor** consumes TxLINE real-time SSE → writes Neon +
   fires `sendPush` (+ optional client fan-out). Modern serverless-native option:
   a **Cloudflare Durable Object / Worker** (holds the persistent connection); or a
   tiny Railway/Fly process. One isolated component.
2. **Cron polling stays as the backstop** — if the ingestor drops or dies, polling
   still covers scores/notifications/resolution. Real-time when healthy, polling
   when not.
3. **Vercel app unchanged** — reads Neon, serves UI.
4. **Derivation reused as-is** — `deriveGoals` / `deriveLiveScore` are pure
   functions the ingestor calls on the stream. No rewrite.

## Now (this WC): the polling hybrid

1. **Server sync loop** — one cron hit runs several syncs within the 60s function
   budget while matches are live → ~15s server freshness, no new infra.
2. **Adaptive client poll** — ~15s while a match is live, ~45s idle,
   visibility-gated.
3. **On-demand SSE pull for accuracy** — goal detection reads TxLINE's
   `/scores/updates` **stream** (which *is* SSE) for live fixtures, because the
   snapshot only keeps the latest goal per action-type. Goals dedup by the action's
   stable `Seq`. This is a surgical use of the stream without holding a connection.

This delivers ~90% of the practical benefit at ~10% of the cost/risk, and fixes the
real user-facing issue (missed/duplicated goals) — which is **correctness, not
latency**.

## Consequences

- **Positive:** simple, serverless-native, self-healing; notifications + resolution
  run with zero clients; no new ops surface during the tournament; a clean upgrade
  path (the ingestor can slot in later and reuse all derivation).
- **Negative / accepted:** live display + goal pushes lag real-time by ~15–30s
  until (if) the ingestor is built. Acceptable for a pick game.
- **Revisit when:** the product becomes latency-critical (e.g. live watch-party,
  second-by-second social reactions), or goal-push latency becomes a real
  complaint. Then build the Durable-Object ingestor with cron as backstop.
