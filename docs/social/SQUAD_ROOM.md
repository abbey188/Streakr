# Squad Room — Design Spec

> The first real social layer for Streakr. A private, per-group conversation
> space that turns the existing (inert) group activity feed into a two-way one.
> Decided by interrogation on 2026-07-10; visual design settled 2026-07-11;
> build on a feature branch, merge when tested.
>
> **Visual mockup (design record):**
> https://claude.ai/code/artifact/d201f650-ea8e-4837-be87-ad5856ee8b7b

---

## What this is (and isn't)

**Is:** a *squad chat with the game woven in*. One time-ordered stream per group
where member messages and system match-events (streak milestones, crowns, badge
unlocks, streak breaks) interleave. Members react to anything and reply one level
under anything.

**Isn't:**
- Not a public feed — this is private to a group's members. (The public **Fan
  Feed** is a separate, later surface; see `## Later: the Fan Feed`.)
- Not a Reddit forum — no nested threads, no separate topic pages. Light
  threading only (one level of replies), because a 5–20 person squad doesn't
  have the scale that earns forum structure.
- Not live chat — async, polls like the rest of the app. No always-on worker,
  no new infra (this is the ADR-0001 line we are deliberately staying behind).
- Not a "make a post" box in the public sense — but within your *own private
  squad*, freeform messages are expected and safe (it's your mates).

## Why the Squad Room first

- Builds directly on `group_activity_events`, which already exists, is wired
  end-to-end (query → route → Inbox), and is currently read-only with dead
  reaction scaffolding.
- Fills itself with content (your squad talks; match events post themselves).
  The Fan Feed's hardest unsolved problem — where public content comes from —
  does not exist here.
- Near-zero moderation risk: private, among members who chose each other.
- Proves the reaction + reply + notification mechanics on a safe surface before
  we bet them on a public feed.

---

## Decisions locked

| Question | Decision |
|---|---|
| First surface | Squad Room (private group), not the public Fan Feed |
| Shape | Squad chat + light (one-level) threading, not a forum |
| Messaging | Async threaded comments — NOT live chat, no new infra |
| Reactions | Fixed set of 6 on-brand emoji: 🔥 👏 😂 💀 😮 👑 |
| Reply depth | One level, flat. No infinite nesting. |
| Reply notifications | Ping on reply (push + Inbox), gated by a new `squad` pref. Reactions stay silent. |
| Branch | Feature branch, merge to `main` when tested (main auto-deploys to prod). |

### Visual decisions (design review 2026-07-11; **v2 revised after live preview** — see mockup)

The first build put messages and events in one uniform stream. Seeing it live,
that flattened the experience — so v2 splits them:

| Aspect | Decision (v2) |
|---|---|
| **Model** | **Messages = chat; events = collapsible inline thread cards**, in ONE timeline. A message flows (grouped bubbles); an event is a bordered card you tap to expand. |
| Message style | **Discord-style: all left-aligned, avatar-led, grouped** (consecutive messages from one author share an avatar). Bubbles. Own messages read **"You"**. |
| Message reactions | **Hug the bubble** (small chips under it). No ＋ on messages. |
| Message gestures | One gesture per action, **no long-press**. **Mobile:** swipe → reply (Telegram/WhatsApp); tap → react (six-emoji palette pops). **PC:** hover → floating toolbar (quick-react · ＋ · ↩ Reply). Swipe uses `motion/react` `drag` (already a dependency) — slide, elastic, spring-back and **direction-lock** (no scroll conflict) are built in. |
| Message reply | **Telegram-style quote-reply, inline in the chat**: a reply bar (Reply to @X + ✕) shows over the composer; the sent reply is a normal chat message carrying a quoted snippet of the original. (Event replies go into the event's thread instead.) |
| Event card | Collapsed: header + reaction summary + a **Slack-style thread affordance** (stacked replier avatars + "N replies" + chevron). Tap → expands to the reaction palette, replies (≤5, then "view all N"), and a reply box. |
| Thread expansion | **No "Collapse" text** — the affordance IS the control: chevron flips up when open, tapping toggles. The replier avatars are the invitation. |
| Event reactions | Live **inside the card**. Add via the **＋** or the palette when expanded. Tap is reserved for expand/collapse, so it can't double as react. |
| Event look | Coloured **left edge** + **type chip** (🔥 Streak / 👑 Crown / 💀 Broken); **wins glow** amber, **breaks fade**, milestone neutral. |
| Attribution | **"You"** for the viewer's own events/messages/replies; **"@username"** for everyone else. Feed AND push copy. |
| Avatars | Real `AvatarRenderer` (`upperBodyOnly`) — but **sized to fit the tile**. The first build clipped it (fixed-px avatar in a too-small box, uncentred); render at a size that fits per row (message vs reply). |
| Keyboard | Composer **rides above the on-screen keyboard** (visualViewport API); stream auto-scrolls to newest. iOS standalone PWA is the finicky case — its own build task. |
| Entry point | **Squad Room** tab beside Leaderboard, PLUS an **unread count per group** on the Groups list. |

---

## Data model

The existing `group_activity_events` stays as the **system-event** source. Add
two tables: member messages, and normalized reactions.

```sql
-- Member-authored messages + replies. System events live in
-- group_activity_events; the read merges both into one timeline.
create table if not exists group_messages (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  author_address text not null references users(wallet_address) on delete cascade,
  body          text not null,                 -- trimmed, length-capped in the route
  -- One-level threading: a reply points at its parent message. Replies to a
  -- SYSTEM event point at parent_event_id instead. Exactly one is set for a
  -- reply; both null for a root message.
  parent_message_id uuid references group_messages(id) on delete cascade,
  parent_event_id   uuid references group_activity_events(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index if not exists group_messages_group_idx
  on group_messages (group_id, created_at desc);

-- Normalized reactions: source of truth for who reacted with what, on either a
-- message or a system event. Counts are DERIVED (group by), so toggling is
-- idempotent and we never double-count. The denormalized json on
-- group_activity_events is dropped as a source of truth (may stay as a cache).
create table if not exists group_reactions (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  user_address  text not null references users(wallet_address) on delete cascade,
  target_type   text not null check (target_type in ('message','event')),
  target_id     uuid not null,                 -- group_messages.id OR group_activity_events.id
  emoji         text not null,
  created_at    timestamptz not null default now(),
  -- One user, one emoji, one target — tapping again toggles it off.
  unique (target_type, target_id, user_address, emoji)
);
create index if not exists group_reactions_target_idx
  on group_reactions (target_type, target_id);
```

**Why normalized reactions, not the existing json count-map:** the json map
(`{ "🔥": 3 }`) can't answer "did *I* already react?" or prevent a user
inflating a count by tapping repeatedly. A normalized table makes reactions
toggle-able and idempotent, and counts are a cheap `group by`.

---

## Read model — one merged timeline

`getSquadFeed(groupId, viewer)` returns a single array, newest-anchored,
composed of:
- roots: system events (`group_activity_events`) + root member messages
  (`group_messages` where both parents null), interleaved by `created_at`
- each root carries: its replies (one level), and its reaction summary
  (`{ emoji: count }` + which emoji the viewer picked)

Shape (frontend type, `src/types.ts`):
```ts
type SquadReaction = { emoji: string; count: number; mine: boolean };
type SquadReply = { id; author; avatar; body; createdAt; reactions: SquadReaction[] };
type SquadItem = {
  id; kind: "event" | "message";
  author?; avatar?; body; icon?; createdAt;
  reactions: SquadReaction[];
  replies: SquadReply[];
};
```

---

## API (all under the existing `app/api/groups/[id]/`)

| Method + path | Does |
|---|---|
| `GET  /api/groups/[id]/feed` | the merged squad timeline for a member |
| `POST /api/groups/[id]/messages` | post a root message or a reply (`{ body, parentMessageId?, parentEventId? }`) |
| `POST /api/groups/[id]/reactions` | toggle a reaction (`{ targetType, targetId, emoji }`) |

Every route: verify the caller is a **member** of the group (auth already binds
Privy → wallet_address). Trim + length-cap message bodies. Reject unknown emoji
(must be in the fixed set).

---

## Notifications (plugs into what we just built)

- A **reply** to your message → a `squad`-type notification (Inbox row + push),
  gated by a new `squad` key in `notification_prefs` and the `NOTIF_TYPES` list.
  Deep-links to the group's Squad Room.
- **Reactions stay silent** — high frequency, low signal; pinging on every 🔥
  would train people to mute the group.
- Never notify yourself for your own reply.

---

## UI surfaces

- **Groups section** gains a **Squad Room** tab/panel per group: the merged
  stream, a reaction bar on each item (the 6 emoji, tap to toggle), a "reply"
  affordance opening a one-level thread, and a composer at the bottom.
- The **Inbox** "From your groups" section stays as a *personal digest* of
  system events; the Squad Room is where the conversation lives. (We may later
  point the Inbox group rows at the Squad Room.)
- Reaction bar reuses the existing accent language; composer matches the app's
  input styling.

---

## Build phases (each independently shippable behind the branch)

1. **Schema + read** — tables, `getSquadFeed`, `GET /feed`. No writes yet; feed
   renders system events with (real, zero) reactions. Proves the merge/read.
2. **Reactions** — `POST /reactions` toggle, optimistic bar in the UI. The
   dead scaffolding becomes real.
3. **Messages + replies** — composer, `POST /messages`, one-level threads.
4. **Notifications** — `squad` pref + type, reply pings via the existing push
   path.
5. **Polish** — empty state, unread treatment, loading/error states.

Merge to `main` only after phases 1–4 are tested end-to-end on the branch.

---

## Risks / open questions (revisit before merge)

- **Rate limiting.** A message POST is a write endpoint with user content — the
  first genuinely spam-able surface in the app. Wave-3 rate limiting was already
  on the backlog; messages make it load-bearing. At 34 users it's low, but it
  must exist before the Fan Feed.
- **Moderation.** Private squads are low-risk, but there's still no delete/report.
  Minimum: an author can delete their own message. Group-admin moderation later.
- **Read-state / unread.** How "fresh" the poll is, and whether we show an unread
  count on the Groups tab. Reuse the `SEEN_ACTIVITY_KEY` pattern from the Inbox.
- **Legal.** Privacy + Terms already name "posts, comments, votes, reactions" as
  rolling out — so we're covered, but re-read before merge.

---

## Later: the Fan Feed (NOT this build)

The public, swipeable feed off Hub/Play. Deferred because its hardest problem —
**where public content comes from** — is unsolved, and because public comments
are a real moderation commitment. The Squad Room proves the reaction/reply/
notification mechanics we'll reuse. Candidate content sources to decide later:
auto-threads from match events (goal/upset/result), editorial curation, or an
external news source. Revisit after the Squad Room ships and the World Cup ends.
