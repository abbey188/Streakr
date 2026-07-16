# Streakr

**A free-to-play World Cup 2026 knockout-pick streak game — with a live, TxLINE-powered
match feed you can drop straight into your squad chat.**

🔗 **Live product:** **[streakr.click](https://streakr.click)** · Built for the **TxLINE
live-data + Solana** track.

Pick who advances in each knockout tie (winner after ET/penalties — no draws). Get it
right, your **streak** grows. Get it wrong, it resets. Points bank permanently. The Final
crowns *The Streakr*.

But the picking is only half of it. The other half is the **Hub**.

> This repository is the source of a **running product with real users**, shared here so
> the build can be reviewed. It isn't a template or a starter — it's the thing that's
> live at streakr.click.

---

## The Hub — the live feed

Streakr's Hub is a live, scrollable feed of *everything happening in the tournament right
now*, derived entirely from the TxLINE action log — and every moment carries a one-tap
**"↗ Share to squad"** that drops it into your group chat as a rich card people react and
argue about.

**Watch → react → share → argue.** That loop is the product.

What the feed surfaces, all from TxLINE:

| | |
|---|---|
| ⚽ **Goals** | named scorer, penalties marked |
| 🟨🟥 **Cards** | named player, straight red vs second yellow |
| ⇄ **Substitutions** | both players named, on and off |
| 📺 **VAR** | *what* was reviewed — "the goal is overturned by VAR" |
| 🎯 **Shots on target** | names the **keeper** who made the save |
| 🚩 **Corners** · 🧱 **Free kicks** | free kicks colour-coded by threat |
| 📋 **Lineups** | posted **before kickoff**; tap for the full XI + bench |
| ⏱ **Match state** | kick-off, half-time, extra time, penalties |
| 🏁 **Full-time** | *who advances* — "Spain are through" |
| 📊 **Momentum** | **our own derived read** — see below |

Minutes render as football does: a goal in stoppage reads **`90+4'`**, not `94`.

A shared moment lands in the **Squad Room** as a frozen card — icon, players, score and
minute captured at share time — so the argument still reads on its own an hour later.

### Momentum — the part that isn't in the data

TxLINE doesn't have a "momentum" field. We built one.

It's a blended index over the last ~10 minutes of match clock: the **five possession
tiers** TxLINE streams (`possession`, `attack_`, `danger_`, `high_danger_`, `safe_`)
weighted by danger, **plus shots** (a shot on target weighs heavily) and corners. When one
side crosses 60% of that weighted momentum, the feed posts a card with a possession bar
and a plain-English read — *"Spain turning the screw"*, *"camped in the other half"*.

It won't fire before the 20th minute, it's bucketed so it can't spam, and the bar's bright
fill sits on whichever side actually has the momentum. It reads like live punditry, off
real data.

---

## Architecture — how the live data flows

Everything on screen traces back to the TxLINE action log. The client **never** touches
TxLINE; the API token stays server-side.

```
TxLINE (snapshot + action log)
        ↓  cron → syncLiveFixtures()   ← loops every 15s while a match is live
   derive: score · goals · match events · momentum
        ↓
     Neon Postgres  (fixtures, match_events)
        ↓  one adaptive, visibility-gated client poll (15s live / 45s idle)
   Hub feed · live strip · notifications · pick resolution
```

Deliberately **cron → database → poll**, not sockets — the reasoning is recorded in
[`docs/adr/0001-live-data-architecture.md`](docs/adr/0001-live-data-architecture.md).

The action log is a **full, retransmitting stream**, so we re-derive it on every poll and
**upsert** on a stable content key. That means a cron gap **self-heals** instead of leaving
holes — and nothing is ever double-inserted.

---

## Where it goes next — beyond the World Cup

The World Cup is the launch competition, not the ceiling. Most of what's here is already
sport-agnostic: identity, streaks and points, squads and the Squad Room, notifications,
the share loop, and the whole cron → derive → Neon → poll pipeline don't know what a goal
*is*.

Only two thin slices are football-shaped, and they're the seams we expand along:

- **The normalizer** — turning a sport's action vocabulary into feed moments. Football
  speaks in goals, cards, subs and VAR; another sport speaks in wickets, tries or
  timeouts. Same pipeline, new vocabulary.
- **The pick primitive** — "who advances" is knockout-shaped. A league season needs a
  different one (a result, a table position), which is the next model we build.

**Momentum generalises too.** The index isn't football logic — it's *"weight recent
danger-heavy events over a rolling window and call the swing."* The weights change per
sport; the read doesn't.

So a new sport is a **normalizer + a pick model + its phrasing**, against a pipeline
that's already proven against live data. TxLINE carries other sports, which is what makes
that tractable rather than a rewrite. The nearest step is a **league/season model** — the
same expansion work aimed at a new competition shape rather than a new sport.

---

## Solana

- **Identity** — Privy whitelabel auth (email / Google / Apple) provisions a **Solana
  embedded wallet** for every user. The wallet address *is* the account key: no seed
  phrase, no wallet install, no crypto knowledge needed to play.
- **Data access** — TxLINE access is activated by an **on-chain Solana subscription**
  (`TXLINE_SUBSCRIBE_TXSIG` is the transaction proof). The live data powering the Hub is
  paid for on Solana.

---

## Stack

Next.js 15 (App Router, React 19) · TypeScript · Tailwind v4 · Neon Postgres (HTTP driver)
· Privy (Solana embedded wallets) · TxLINE/TxODDS live data · Web Push (VAPID) · Vercel ·
installable PWA.

Every deploy is gated on `tsc --noEmit` + a clean production build, and verified live
before anything is called done.

---

## Docs

| Doc | What's in it |
|---|---|
| [`docs/txline/FEED_LOG.md`](docs/txline/FEED_LOG.md) | **TxLINE feedback** — anomalies found in live data, and our mitigations |
| [`docs/adr/0001-live-data-architecture.md`](docs/adr/0001-live-data-architecture.md) | Why cron → Neon → poll, not sockets |
| [`docs/social/LIVE_FEED.md`](docs/social/LIVE_FEED.md) | The Hub feed — design + engineering spec |
| [`docs/social/SQUAD_ROOM.md`](docs/social/SQUAD_ROOM.md) | Squad Room (group chat) design |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | What's shipped, how we build, roadmap |
