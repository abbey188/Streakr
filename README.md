# Streakr

**The knockouts, turned into a game you play with your squad.**

Streakr is a free-to-play, live, social football experience. You **call who advances**,
put a **streak** on the line, follow every match as **live commentary** in the Hub, and drop
any moment straight into your **squad** to argue about. Live at
**[streakr.click](https://streakr.click)** — built for the **TxLINE live-data + Solana** track.

> This repository is the source of a **running product with real users**, shared here so the
> build can be reviewed. It isn't a template or a starter — it's the thing that's live at
> streakr.click.

---

## The thesis

Score and prediction apps optimise one thing: **data density**. They're encyclopedias you
read alone — which makes them **passive** (you consume; nothing's at stake) and **anonymous**
(a global like button, no one you actually know).

Streakr competes on the other axis — **participation and belonging**:

- **You have skin in it.** Every pick puts your streak on the line — right, it grows; wrong,
  it's gone. That's a reason to care about a match you'd otherwise scroll past.
- **You're not alone.** Every goal is an argument you send to your squad — a private group of
  people you know, with its own chat, leaderboard, and crown.
- **It's live.** The Hub narrates the match in real time off real data, so there's always
  something happening to react to.
- **It's in your pocket.** Live sport is a second-screen behaviour — the phone is where fans
  react while they watch. Streakr is built for that surface first, not ported to it.

The match data is commoditised — that's what TxLINE is for. The *product* is the **loop** those
three layers create:

> **Call it → watch it live → share it → argue → come back for the next round.**

---

## Three layers, one loop

### 1 · The Game — the stakes
Pick who advances in each knockout tie (winner after extra time and penalties — **no draws**).
Get it right, your **streak** grows; get it wrong, it resets. Points bank permanently, and the
Final crowns **The Streakr**. The pick window stays open until the first goal, a red card, or
the second-half whistle — so get in early.

### 2 · The Hub — the broadcast
A live, scrollable feed of everything happening in the tournament right now, derived entirely
from the TxLINE action log — and it **reads like commentary, not a scoreboard**:

- **Narrated goals that know the state of the game** — *"Gordon opens the scoring" → "Fernandez
  draws it level" → "Martinez puts Argentina ahead."* The words come from the running score,
  not a template.
- **The score as it stood** on every card — a 10th-minute chance shows 0–0 even if the match
  finished 4–2.
- **The match as a story** — synthesized bookends turn a data stream into a narrative: kickoff,
  a **half-time card** (the score at the break), *"second half begins,"* and a **full-time
  verdict** — *"Argentina snatch it — a 91' winner sends them past England."*
- **Did you call it?** — your own pick result closes each finished match: *"You called it —
  streak safe"* or *"Not this time — you had France."*
- **Momentum**, **reactions** on any moment, and a one-tap **↗ Share to squad**.

Minutes render as football does: a goal in stoppage reads **`90+4'`**, not `94`.

#### Momentum — the part that isn't in the data
TxLINE doesn't have a "momentum" field. We built one. It's a blended index over the last ~10
minutes of match clock: the **five possession tiers** TxLINE streams (`possession`, `attack_`,
`danger_`, `high_danger_`, `safe_`) weighted by danger, **plus shots** (a shot on target weighs
heavily) and corners. When one side crosses 60% of that weighted momentum, the feed posts a card
with a possession bar and a plain-English read — *"Spain turning the screw," "camped in the other
half."* It won't fire before the 20th minute, it's bucketed so it can't spam, and it reads like
live punditry off real data. **The index isn't football logic — it generalises to any sport by
changing the weights.**

### 3 · The Squads — the people
Squads are Streakr's social graph — private groups of people you actually know. Each has its own
**leaderboard** (by streak or points), a **crown** for the round champion, and a full-screen
**Squad Room** chat. Share a feed moment and it lands in the room as a frozen card — icon,
players, score and minute captured at share time — that people react and reply to, and you're
dropped **straight into the chat**.

New activity **pulls you back in**: an unread badge cascades from the **Squads tab → the specific
squad → the chat button**, and a squad notification in your Inbox taps **directly into the room**.
That's the "come back for the next round" half of the loop, made concrete.

---

## Built for the pocket

Streakr is **mobile-first** — not by default, by thesis. Live sport is a **second-screen**
behaviour: the match owns the TV, the phone owns the *participation* — checking the score,
reacting, texting the group. That's where the fan is when the moment happens, so that's what we
build for.

Three consequences run all the way down the stack:

- **The feed is the mobile-native format.** A vertical, real-time, one-moment-per-card scroll is
  how a phone consumes a live match — thumb-scrollable, glanceable, react and share in one tap. A
  stat table is a desktop artifact; the Hub is a pocket one.
- **We reward a 15-second glance.** Fans engage in slivers — half-time, the commute, a queue. The
  feed, the streak, and the squad badges answer the only questions that matter in that sliver —
  *what just happened, did my pick survive, what's my squad saying* — with no "session" required.
- **Push is the loop.** The phone buzzes with a goal, a pick reminder, or squad banter; you tap;
  you're back in the moment. Re-engagement is native, not a growth hack bolted on.

None of that is a port — it's in the stack:

| Built for | How |
|---|---|
| **Install, no store** | Installable **PWA** — home-screen icon, standalone, runs like native |
| **Reaching a closed app** | **Web Push** (VAPID) — goal, pick-deadline, and squad alerts |
| **Typing over the keyboard** | Keyboard-aware layouts (`visualViewport`) — composer sits above the keys, iMessage-style |
| **Chatting like a chat** | Full-screen **Squad Room**, not a cramped modal |
| **Respecting the hardware** | Safe-area insets + standalone handling for the notch and home indicator |
| **Battery & data** | Visibility-gated adaptive polling — quiet when the tab is backgrounded |

**Where it goes:** quick-pick straight from the notification, react-from-push, Live Activities /
lock-screen score + pick, and a home-screen streak widget — deeper into the on-the-go moment,
where the fan already is.

---

## Architecture — how the live data flows

Everything on screen traces back to the TxLINE action log. The client **never** touches TxLINE;
the API token stays server-side.

```
TxLINE (snapshot + action log)
        ↓  cron → syncLiveFixtures()   ← loops while a match is live / imminent
   derive: score · goals · match events · momentum · who advances
        ↓
     Neon Postgres  (fixtures, match_events, picks, squads)
        ↓  one adaptive, visibility-gated client poll (15s live / ~10 min idle)
   Hub feed · live strip · squad badges · notifications · pick resolution
```

Deliberately **cron → database → poll**, not sockets — the reasoning is recorded in
[`docs/adr/0001-live-data-architecture.md`](docs/adr/0001-live-data-architecture.md).

Two properties matter:

- **Self-healing.** The action log is a full, retransmitting stream, so we re-derive it on every
  poll and **upsert** on a stable content key. A cron gap fills itself instead of leaving holes,
  and nothing is ever double-inserted.
- **Idle-cheap.** When nothing's live the client polls only every ~10 minutes — longer than the
  database's autosuspend window — so compute scales to zero between matches instead of being held
  awake around the clock.

---

## Solana

- **Identity** — Privy whitelabel auth (email / Google / Apple) provisions a **Solana embedded
  wallet** for every user. The wallet address *is* the account key: no seed phrase, no wallet
  install, no crypto knowledge needed to play. Sign in with Google, you're in.
- **Data access** — TxLINE access is activated by an **on-chain Solana subscription**
  (`TXLINE_SUBSCRIBE_TXSIG` is the transaction proof). The live data powering the Hub is paid for
  on Solana.

The whole point: the chain does the heavy lifting (identity, paid data) while the player never
sees it. Web2 ease, web3 rails.

---

## Roadmap — three axes of expansion

The World Cup is the launch competition, not the ceiling. Almost everything here — identity,
streaks and points, squads and the Squad Room, notifications, the share loop, and the whole
cron → derive → Neon → poll pipeline — is already **sport- and tournament-agnostic**. Growth runs
along three axes:

**1 · More competitions — same sport, new shapes.**
Knockouts are one pick shape ("who advances"). Leagues and seasons need others — a match result,
a weekly streak, a final table position. The next model we build is a **league/season**
competition, which opens the door to domestic leagues, the Champions League, and continental
tournaments on the same rails.

**2 · More sports.**
The pipeline doesn't know what a goal *is*. A new sport is a **normaliser** (its action vocabulary
→ feed moments), a **pick model**, and its **phrasing** — dropped onto a pipeline already proven
against live data. Momentum comes along for free (only the weights change). TxLINE carries other
sports, which makes each new one an extension, not a rewrite.

**3 · More ways to play with people.**
The private squad is the seed of a social graph. From there: **public communities and open
leagues** (not just squads you're invited to), **head-to-head rivalries** and cross-squad
tournaments, **seasons** with resets and a hall of fame, live **watch-party** threads pinned to a
match, and community / creator leaderboards. The deeper the social layer, the stronger the loop —
and the loop is the moat.

---

## Stack

Next.js 15 (App Router, React 19) · TypeScript · Tailwind v4 · Neon Postgres (HTTP driver) ·
Privy (Solana embedded wallets) · TxLINE live data · Web Push (VAPID) · Vercel · installable,
mobile-first **PWA** (home-screen install, keyboard-aware layouts, full-screen chat, push alerts).

Every deploy is gated on `tsc --noEmit` + a clean production build, and verified live before
anything is called done.

---

## Docs

| Doc | What's in it |
|---|---|
| [`docs/txline/FEED_LOG.md`](docs/txline/FEED_LOG.md) | **TxLINE feedback** — anomalies found in live data, and our mitigations |
| [`docs/adr/0001-live-data-architecture.md`](docs/adr/0001-live-data-architecture.md) | Why cron → Neon → poll, not sockets |
| [`docs/social/LIVE_FEED.md`](docs/social/LIVE_FEED.md) | The Hub feed — design + engineering spec |
| [`docs/social/SQUAD_ROOM.md`](docs/social/SQUAD_ROOM.md) | Squad Room (group chat) design |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | What's shipped, how we build, roadmap |
