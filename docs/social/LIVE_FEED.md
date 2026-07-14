# Live Feed — Design & Engineering Spec

> The move that turns Streakr from a streak game into the app you open during
> every match: a live, TxLINE-powered pulse of the whole tournament, and a
> one-tap bridge from any moment into your squad chat. Scoped 2026-07-13.

---

## The idea in one line
A **live match feed** in the Hub (goals, cards, VAR, shots, lineups — straight
from TxLINE), where every moment has **↗ Share to squad** → it lands in the
Squad Room as a rich card people react and reply to. Watch → react → share →
talk. That loop is the premise nothing else has.

It also quietly solves the old Fan-Feed blocker: a public post-wall needed
content + moderation; a **TxLINE feed has infinite fresh content and zero
moderation surface** — the content *is* the tournament.

---

## Decisions locked
| Question | Decision |
|---|---|
| Rename the Hub? | **No — keep "Hub".** "Live" adds nothing; keeps routes/copy stable. |
| What's in the Hub now? | A **compact live-scores strip** (LIVE matches only, horizontal scroll, space-efficient) at the top + the **moment feed** below. Nothing else. |
| Past / finished matches? | The existing history browser **stays exactly as it is** — reached via a **"See past matches"** button at the **bottom of Play**. Not called "Results" (that reads as *pick* results). |
| Feed content source | **TxLINE only** for the submission. An external news source is a clean post-hackathon add — parked. |
| Sharing | A squad message gains an optional **attachment** (the moment); the chat renders a card. Reactions/replies/notifications/delete already work on it. |

---

## Data architecture — "fresh everywhere, no page-dependency"

**Today:** `TxLINE → sync-live cron → Neon` writes fixtures/scores/status/goals +
notifications. Match detail derives the full timeline **on-demand** per request
(`buildEvents`) — events are **not stored**. The client's `app-state` already
polls `/api/fixtures` adaptively (**15s live / 45s idle, visibility-gated**), so
fixtures are globally fresh — but the **viewer's own streak/points aren't
polled**, and there are ~7 scattered per-page pollers.

**Plan — one unified live-data core** in `app-state`: a single adaptive,
visibility-gated poller that keeps **fixtures + feed events + the viewer's
streak/points + unread** current app-wide. Every surface reads shared state;
nothing waits for you to visit Play. Fold the scattered leaderboard/groups/
inbox/streak polls into it (keep squad's 8s and match-detail's 10s as
surface-specific fast polls).

**The feed needs persisted events.** `sync-live` already fetches the action log
for live fixtures — it now also **writes events into `match_events`**, and the
feed reads Neon. Same proven pattern as goals:
`TxLINE → cron → Neon → one client poll → all surfaces.` The client never hits
TxLINE directly (API token stays server-only).

---

## The feed data model

```sql
create table if not exists match_events (
  id          uuid primary key default gen_random_uuid(),
  fixture_id  text not null references fixtures(id) on delete cascade,
  seq         integer not null,           -- TxLINE action Seq: the dedup key
  type        text not null,              -- goal|yellow|red|var|shot|offside|corner|lineup|kickoff|ht|ft|pen
  minute      integer,
  payload     jsonb not null default '{}'::jsonb, -- scorer, teams, score-at-time, outcome, side
  confirmed   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (fixture_id, seq)
);
create index if not exists match_events_recent_idx on match_events (created_at desc);
```

- **Cron** derives events (buildEvents-equivalent) and **upserts** new ones each
  sync (dedup by `(fixture_id, seq)`).
- **`GET /api/feed`** → recent events across live + just-finished matches,
  newest-first, bounded (~60), each with match context (teams, current score).
  Polled by the live core.
- **Share** → `group_messages.attachment jsonb` embeds the moment payload; the
  Squad Room renders a moment-card above the comment.

### Event types (all real TxLINE data we already parse)
goal (w/ scorer) · yellow · red · VAR (stands/overturned) · shot on target ·
offside · corner · lineup announced · kickoff · half-time · full-time · penalty.

---

## Lineups & robustness

- **Lineups publish *before* kickoff** (TxLINE drops them pre-match, ~1hr out);
  the action log carries a `Lineups` block once live. The cron currently polls
  only *live* fixtures — **extend it to also poll upcoming fixtures within a
  pre-kickoff window (~≤2hrs to KO)** to catch lineups + the kickoff transition.
- **Robustness rules** (extending the goal-handling we already ship):
  - Dedup by `(fixture_id, seq)` (unique index).
  - Confirmed-only where it matters — a VAR-pending goal waits; a VAR *overturn*
    is its own event.
  - The unnamed→named scorer **updates the same event** (keyed on running score),
    never emits twice.
  - Never phantom — require a real action (the `status:100` lesson).
  - Order by kickoff time + seq.
  - Per-fixture try/catch: one bad event never breaks the sync or the feed.
  - The action log is a **full log**, so we re-derive + upsert each poll — a cron
    gap **self-heals**; no fragile deltas.

---

## IA / navigation

- **Hub** = live-scores strip (live only, scrolls) → moment feed. Match detail
  reused as-is (tap a strip item or a feed moment).
- **Play** gains a **"See past matches"** button at the bottom → the existing
  finished-matches history browser, unchanged.
- **Deep-links:** goal → Hub (that match) · squad reply → that Squad Room ·
  pick result → Play · crown → Play. (Notification `url` carries the target.)
- **Back / swipe** pops cleanly everywhere: Hub → detail → back · feed → share →
  Squad → back.

---

## Naming/copy — minimal (Hub kept)
- **Stays:** Hub, Play, Groups, Inbox, Profile, the whole match-detail page.
- **Adds:** "See past matches" on Play; the feed + live strip inside the Hub.
- No route rename, no nav relabel — the churn we avoided by keeping "Hub".

---

## Build order (each phase shippable)
1. **`match_events` schema + cron writes events.** Data accrues; no UI change.
2. **`GET /api/feed`** + fold the feed into the unified live-data core.
3. **The Hub UI:** live-scores strip + moment feed (replaces the stacked cards).
4. **Share-to-squad:** message `attachment` + the moment card in chat.
5. **Notification deep-links** to the exact page.
6. **"See past matches"** on Play (link the existing browser).
7. **Fold streak/leaderboard/unread into the live core** — kills the last
   staleness so every page is always current.

---

## Later (not this build)
External news source woven into the feed; the feed as a surface for sponsored/
branded moments (a monetization path).
