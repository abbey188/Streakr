# Streakr — UX / UI Issues Log

Running log of UX/UI issues surfaced during review. Each is a discrete, fixable
unit. Status: **Open** → **In progress** → **Done**.

---

## Issue 1 — Round Champion is invisible; no per-round view; no overall champion
**Status:** A+B DONE (deployed 6d148e7) · **C DROPPED** (card too small for per-round
champion inlines — not worth the clutter) · **D KEPT** (overall champion; approach to be
decided closer to the Final) · **Area:** knockout card
- **A (done):** each round in the stepper is tappable → its standings + crowned
  champion (past rounds incl. R32). Reuses getRoundRace (returns global crown).
- **B (done):** crown() now broadcasts to ALL round-pickers (not just the winner),
  prefs-respected, global-only, idempotent, failure-isolated from resolution.
- **R32 (done):** resolved this morning, so the crowning was still timely — sent a
  one-off idempotent broadcast to the 14 R32 pickers (@Kofo, 2 correct) before R16
  kicks off tonight. B covers R16/QF onward automatically.
- **C (deferred):** show the champion inline on the card (needs a champions fetch).
- **D (deferred):** overall "The Streakr" champion at Final. Door is open —
  round_champions can hold a `Tournament` sentinel row; build near the Final.

### Symptom (as reported)
"R32 is over but no one was crowned, no notification was sent, and it just moved
on to R16." Users can't see who won a round, and can't look back at past rounds.

### Root cause (verified against prod data)
The crowning engine **works** — it's purely a surfacing gap:
- `round_champions` has 5 R32 rows (global champ `6iChDm8…`, 2 correct, + 4 group champs).
- 5 `round_champion` notifications were delivered to those champions.
- `crownRoundChampions()` runs in `resolveFinishedFixtures()` and is idempotent.

What's actually wrong:
1. **Only the champion is told.** `crown()` notifies just the winner + emits a group
   event to *their* group. Everyone else (incl. non-champions) sees nothing that a
   round concluded or who won → feels like "nothing happened."
2. **The card only opens the *current* round.** `onClick` fires
   `setRaceRound(currentStage.round)`; `currentStage` = first non-done round. The
   moment R32 completes it's replaced by R16, and R32's champion becomes
   unreachable — the stepper dots aren't individually tappable.
3. **No overall end-of-tournament champion** concept exists.

### Proposed fixes
- **A. Per-round view (core):** make each stepper round tappable → open *that*
  round's race modal; show completed rounds' champion inline (`R32 🏆 @winner`).
  Data already in `round_champions`.
- **B. Broadcast the crowning:** on crown, notify *all users who picked in that
  round* (respect `round_champion` pref): "🏆 @X is your {round} Champion — N correct."
- **C. Champion on the card:** render the winner's name/avatar per completed round
  on the stepper/summary, visible without tapping.
- **D. Overall "The Streakr" champion (design now, build toward):** when the Final
  completes, crown a tournament-wide champion. Metric: most correct picks across
  all knockout rounds (tiebreak longest streak). Persist as a `Tournament` sentinel
  in `round_champions` (or a dedicated record). The Final node culminates here.
- **E. Optional:** retroactively broadcast the already-crowned R32 (idempotency guard).

### Touch points
- UI: `src/components/ScreenHome.tsx` (knockout card + race modal)
- Server: `lib/db/resolution.ts` (`crownRoundChampions`, `crown`), `/api/rounds/race`
- Data: `round_champions` (already exists); possible `Tournament` sentinel row

### Design note — keep the door open
Whatever we build for per-round champions must generalize to a single overall
"The Streakr" champion at tournament end. Prefer one champions model that scopes
by round OR the whole tournament, not a bespoke path per round.

---

## Issue 2 — Can't view a live match's stats from Play (must go to the Hub)
**Status:** DONE (deployed 86bdaf8) · **Area:** Play page → "Matches Live Now" cards
Shipped: live cards tappable → full-screen match-detail overlay (reuses
ScreenMatchDetail, polling cleanup on close), chevron/hover affordance. Hub route
unchanged. Shared `openMatchDetail` action deferred (Play-local state for now).

### Symptom (as reported)
When a match is live on Play, you can't tap it to see the match details/stats —
you have to navigate to the Hub just to peek. The Hub should stay as the
history/browse surface; Play should let you tap a live match to see it inline.

### Root cause (verified)
- The live-match cards on Play (`ScreenHome.tsx` ~L318) are plain, non-interactive
  `<div>`s — **no onClick**. Nothing opens on tap.
- The only path to match detail is the Hub **route**:
  `app/(app)/hub/[fixtureId]/page.tsx` → `<ScreenMatchDetail fixtureId onBack={router.push('/hub')} />`.
- Good news: `ScreenMatchDetail` is already a self-contained `{ fixtureId, onBack }`
  component — it fetches its own data and polls while live. So it can be reused
  in a modal with no data changes.

### Proposed fixes
- **1. Tappable live cards:** wrap the live card in a button/onClick that opens a
  match-detail overlay **on Play** (no Hub navigation).
- **2. Reuse `ScreenMatchDetail` in a full-screen modal** (like the pick/race
  modals). Its back arrow maps to "close." It already polls live.
- **3. Tap affordance:** add a chevron / "Live stats" hint so it's discoverable.
- **4. (Recommended) Shared `openMatchDetail(fixtureId)` app-state action** so the
  same overlay can be triggered from other surfaces later. Hub route unchanged.

_(Dropped an earlier "extend to finished cards" idea: Play has no persistent
finished-matches list — only the dismissible personal "Your Latest Results"
chips, which aren't match cards and are often empty. Not worth wiring.)_

### Touch points
- UI: `src/components/ScreenHome.tsx` (live card tap + modal); optional
  `lib/state/app-state.tsx` (shared open action)
- Reuses as-is: `src/components/ScreenMatchDetail.tsx`, `/api/matches/[fixtureId]`

### Effort
Low — no new data/API work; reuses the existing detail component + endpoint.

### Design note — keep the door open
The tap-to-detail overlay should be a generic action (any fixtureId), so live,
finished, and (future) any match surface can open it. Hub route remains the
canonical "history" browser.

---

## Issue 3 — Announcement surface (backend-drivable glance strip)
**Status:** DONE (deployed 2510ec7) · **Area:** Play page (entry) + new pipeline
Shipped: `announcements` table (schema+prod), getActiveAnnouncements + GET
/api/announcements (fail-soft), fetchAnnouncements client, AnnouncementBanner
(dismissible, localStorage, kind-styled, optional CTA, SSR-safe) at top of Play.
Post one = a single INSERT (no deploy). Data path verified. Audience targeting +
server-side dismissal + Inbox mirror remain future doors. Also: orange-ring
affordance added to the knockout stepper spheres this build.

### Goal (as requested)
A pipeline to surface **announcements/tips/updates** to players — shown at a
glance the moment they enter the app (same dismissible-strip feel as "Your Latest
Results"), drivable from the backend anytime, before fuller detail in the Inbox.
Examples: "Pro streak tip: pick early — picks lock at kickoff"; "enable push to
not miss goals"; "our Terms changed." **Build the surface, not a specific message.**

### Investigation (verified)
- The `notifications` table is **per-user** (`user_address not null`, fan-out per
  person). An announcement is one message → everyone, so reusing notifications
  would mean N inserts per announcement + awkward edit/dismiss. Wrong shape.
- The "Your Latest Results" strip already gives us the exact UX pattern: a
  glanceable, dismissible strip at the top of Play, dismissal via localStorage
  (`dismissedResults`).

### Proposed architecture
- **New `announcements` table** (one row = one announcement):
  `id, title, body, icon, kind (info|tip|warning|update), cta_label, cta_href,
  audience ('all' | future segments), priority, starts_at, ends_at, active`.
  Live = `active` AND now ∈ [starts_at, ends_at] → supports scheduling + expiry.
- **Read:** `GET /api/announcements` → active rows by priority; client fetches on
  app entry (alongside fixtures in app-state).
- **Dismissal:** localStorage set (`streakr_dismissed_announcements`), mirroring
  the results strip. Upgrade path: server-side `announcement_dismissals` table for
  cross-device + **must-acknowledge** announcements (e.g. ToS change).
- **UI:** reusable `<AnnouncementBanner>` at top of Play (above results strip),
  styled by `kind`, dismissible X, optional CTA button. Reusable app-wide later.
- **Backend control:** create via INSERT (seed script / SQL / protected
  `POST /api/admin/announcements`). No deploy needed to post one.

### Doors to leave open
- **Targeting** via `audience` — e.g. the "enable push" tip only to users without
  a push subscription (once push exists), not everyone.
- **Inbox relationship** — strip = glance; CTA can deep-link to Inbox for detail,
  and announcements can optionally mirror into an Inbox "Announcements" section.

### Touch points
- Data: `lib/db/schema.sql` (announcements [+ optional dismissals] table)
- API: `app/api/announcements/route.ts` (GET active); optional admin POST
- Client: `lib/api/client.ts` (fetchAnnouncements), `lib/state/app-state.tsx`
- UI: new `src/components/AnnouncementBanner.tsx`; `ScreenHome.tsx` placement +
  localStorage dismissal; optional `ScreenInbox.tsx` Announcements section

### Effort
Moderate — new table + read endpoint + client fetch/dismiss + banner component.
Reuses the dismissible-strip UX pattern already proven by "Your Latest Results".

---

## Issue 4 — "10 points, no streak" clarification + remove static tip card
**Status:** Done (card removed, staged) · **Area:** Play + scoring

### 4a — "Some users have 10 points but no streak" — NOT a bug
`recomputeUser()` (lib/db/resolution.ts): per resolved pick in kickoff order —
`correct → streak+=1; points += 10*streak; best=max(...)`, `wrong → streak=0`.
So **points are permanent** (banked 10 × streak length, kept forever) and
**streak is the current live run** (resets to 0 on any miss). "10 points + 0
streak" = one correct pick (banked 10), then a later miss. Working as designed.

### 4b — Removed the "Pro Streak Strategy" tip card — DONE (staged, not deployed)
Static always-on "Premium Streak Tip Widget" (`ScreenHome.tsx` ~L727) deleted.
Rationale: evergreen filler occupying prime space; such tips belong in the
**announcement pipeline (Issue 3)** — rotatable/schedulable/dismissible. Nothing
lost: the knockout rule still shows contextually in the pick modal ("Knockout
Stage Rules"). Typecheck clean. Ships with the next deploy.

---

## Issue 5 — Extend the pick window: open until the first goal (BIG model change)
**Status:** SHIPPED (stage 1 a7c79f6, stage 2 d7dca79) · announcement pending copy OK
- **Stage 1 (server):** lib/pick-window (derivePickWindow + getPickWindow with fresh
  live-check, fails closed near kickoff); /api/picks gates on it (409 {reason});
  makePick dropped the kickoff freeze (route is authoritative).
- **Stage 2 (UI):** Fixture.pickOpen + pickCloseReason (schema+sync+query); live
  cards render 4 states (OPEN not-picked CTA / OPEN picked Change / CLOSED locked /
  CLOSED closed·reason); pick buttons stopPropagation vs the detail overlay;
  makePick returns {ok,reason}, app-state reverts + toasts on a raced close.
  Conservative default: unknown pickOpen ⇒ closed.
- **Remaining:** feature announcement via Issue 3 (awaiting copy approval), then
  live-verify the 4 states when R16 goes live tonight.

### Goal (as requested)
Players complain they miss picks because the match starts and they're locked out.
Allow picking **until the first goal OR halftime, whichever comes first** — capped
at halftime (not full time) to limit the late-picker information advantage.

### Rule (FINAL — maps to available data)
Principle: picks are open only while the match is **even and undecided** — 0-0,
11-v-11, first half.

Pickable if: *before kickoff* OR *(live AND period ∈ {H1, HT} AND no MAJOR EVENT yet)*.
A **MAJOR EVENT** = a first CONFIRMED **goal** OR a **red card** (straight or 2nd
yellow). Window also closes when the **second half kicks off** (period → H2).
Runs **through the halftime break** (score frozen, no new play = free accessibility,
zero added info edge), closing at H2 kickoff.

Excluded from "major" (too soft to gate on): yellow cards, corners, subs, momentum.
Penalty-awarded deferred (resolves to a goal quickly; transient) — revisit later.
Detectable via existing confirmed-goal + red-card parsing (`buildEvents`); needs a
small `isPickOpen(entries)` helper.

### Assessment
- **Solves a real retention complaint** (late joiners can still play).
- **Halftime cap (chosen over full-time):** roughly halves the in-play info window
  vs "open until 90'". The first goal — the biggest info event — still closes it
  immediately; we just remove second-half watching. Cleaner fairness.
- **Residual trade-off:** someone joining deep in the 2nd half of a 0-0 still
  misses it (small group), and 1st-half watchers gain *some* info (momentum, cards).
  Accepted as the balance point. Shifts identity slightly to "pick before the first
  goal / halftime."

### Guardrails (required)
1. **Confirmed-goals-only** closes the window (VAR-disallowed goal must NOT close).
2. **Fresh server-side live-score check at pick time** — our score is ~1-min cron
   stale; `makePick` must hit live TxLINE at pick time to prevent a
   goal-already-happened informed pick in the lag window. (Critical anti-exploit.)
3. **Revise: CHANGEABLE until close (ALIGNED).** Pick AND change stay open through
   the whole window; lock only when picks close. Symmetric/fair. Robustness edge:
   handle the modal-open-when-window-closes case (server live-check rejects, UI
   flips gracefully to "closed just now" — no error).
4. **UI:** live cards become visibly pickable when open, flipping to "Closed +
   reason" on a goal/red/H2. Pairs with Issue 2 (tappable live cards).

### Front-facing spec (ALIGNED — build to this)
**Announcement:** delivered via the **Issue 3 announcement pipeline** (prerequisite),
NOT a one-time notification. Voice: punchy-but-clear.

**Live card — 4 states** (card polls live; flips in real time):
- ① OPEN · not picked → CTA `⚡ Pick before the first goal →`; sub-hint
  `Open till the first goal, a red card, or halftime`.
- ② OPEN · picked → `✅ Your pick: {team}` + **Change** button (still changeable).
- ③ CLOSED · picked → `✅ Your pick: {team} · Locked` + close reason.
- ④ CLOSED · not picked → `⏳ Picks closed · {reason}`.

**Close-reason copy:** goal → `first goal`; red card → `red card`; halftime →
plain `Picks closed` (no reason).

**Pick-modal rule line (replaces "locks at kickoff"):**
"⏱️ When picks close: Lock in right up to the first goal, a red card, or halftime
— whichever comes first. After that the tie's too far gone to call, so get in early."

**Announcement copy (for the Issue 3 strip / inbox):**
- Short: "🚀 New: pick after kickoff! Lock in until the first goal, a red card, or
  halftime. Jump into live 0-0 games and keep your streak alive."
- Long: "You've got more time to pick. 🔥 Missed the whistle? No problem. Lock your
  pick until the first goal, a red card, or halftime — whichever comes first. Join
  live goalless games and keep the streak going. The moment the deadlock breaks,
  picks close — so early is still smart."

### Build dependency
Announcement requires **Issue 3** shipped first. Card work pairs with **Issue 2**.

### Interaction
**Replaces the current kickoff-time pick freeze** in `makePick` (the security
guard added in the reliability fix) with the first-goal / regulation-end rule +
live check. Same guard, new condition.

### Touch points
- `lib/db/queries.ts` `makePick` (new pickability rule + live check)
- `lib/txline/*` (a fresh live-score fetch helper for pick-time validation)
- `src/components/ScreenHome.tsx` (live cards pickable when 0-0; closed states)
- Messaging / rules copy update

### Effort
Large — rewrites the pick guard, adds a live check, new UI states, and a
product-identity decision. Deserves its own focused build, not a quick patch.
