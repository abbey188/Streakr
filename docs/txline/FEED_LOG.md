# TxLINE / TxODDS Feed — Anomaly & Handling Log

Living log of quirks we've observed in the live TxLINE soccer feed (World Cup 2026),
how each one hit Streakr, and how we defended against it. **Section 1** is written to
hand to the TxLINE team as feedback. **Section 2** records our own mitigations so we
don't re-derive them. Newest first within each section.

Data path for reference: `getScoresSnapshot` (latest state per action) →
`deriveLiveScore` / `deriveLastGoal` / `buildEvents` (`lib/txline/normalize.ts`) →
sync (`lib/txline/sync.ts`) → notifications (`lib/db/live-notify.ts`) + resolution
(`lib/db/resolution.ts`).

---

## Section 1 — Anomalies to report to TxLINE

### A1 — `StatusId: 100` is attached to a non-terminal `disconnected` action  ⚠️ HIGH
**Observed:** 5 Jul 2026, fixture 18187298 (Brazil v Norway, R16), live at ~90'.
A snapshot entry: `{ "Action": "disconnected", "StatusId": 100, "Confirmed": true }`
while the match clock was still running (91', updated 2s prior).

**Why it matters:** `StatusId 100` is documented as the `game_finalised` settlement
marker. But here it rode on a **`disconnected`** action (a feed/coverage event), not a
match end. Any consumer that treats `StatusId === 100` as "match over" (as the docs
imply) will **falsely finalise a live match**. For us it ended the match and resolved
users' picks mid-game.

**Ask:** `StatusId 100` should be **exclusive to the `game_finalised` action**. Please
don't attach the settlement StatusId to transport/coverage actions like `disconnected`,
`connected`, heartbeat, etc. If 100 can legitimately appear on non-terminal actions,
document exactly which, so consumers can distinguish "settled" from "marker present."

---

### A2 — Aggregate `Score.Total.Goals` increments with no corresponding confirmed `goal` action, then reverts  ⚠️ MED
**Observed:** 5 Jul 2026, fixture 18187298, early. The derived scoreline briefly showed
`0–1` (Norway) and reverted to `0–0`, with **no `goal` action** carrying a `PlayerId`
in the snapshot for that team at that time — i.e. the aggregate `Total.Goals` moved
without a discrete goal event behind it.

**Why it matters:** Consumers that key "a goal happened" off the aggregate count delta
(rather than a discrete `goal` action) will emit **false goal alerts**. We sent a
"Goal — Norway" push to 8 users for a goal that never stood.

**Ask:** Clarify whether `Score.*.Total.Goals` can transiently change without an
accompanying confirmed `goal` action (coverage correction, provisional count, VAR).
Ideally the aggregate count should only move in lockstep with a `Confirmed` goal (or
`penalty_outcome=Scored`) action, and a disallowed/rescinded goal should surface as
`Confirmed:false` rather than a silent count bump/rollback.

---

### A3 — Clarification wanted: does `game_finalised` always co-occur with a terminal phase code?
**Context:** We infer the winning *method* (FT / AET / PENS) from the deepest real phase
StatusId seen (2/3/4=1H/HT/2H, 5=FT, 6–9=ET, 10=AET, 11–13=PENS). We've seen finalise
signalled while the deepest phase code was still mid-play (2H).

**Ask:** Confirm whether a real full-time always emits the terminal phase StatusId
(5/10/13) in addition to `game_finalised`, or whether `game_finalised` can be the *only*
terminal signal. This determines how aggressively we can trust a finalise that arrives
without a terminal phase code.

---

## Section 2 — Our defensive handling (mitigations shipped)

| # | Symptom | Fix | Commit |
|---|---|---|---|
| M1 | `disconnected` (StatusId 100) falsely finalised a live match → picks resolved mid-game | Only the **`game_finalised` action** finalises; a bare `StatusId 100` never does. Added a **"still playing" safety net**: never settle a match whose clock ran within the last 4 min. | `c575723` |
| M2 | A premature finalise on a level 0-0 knockout froze it (null minute → card "HT", picks "closed") | Only settle a mid-play finalise when the result is **decisive** (non-level score or a PE result) — a knockout can't end level. | `fa21575` |
| M3 | Card minute lagged the detail view by ~1 min | Advance the running clock to real-time inside `deriveLiveScore` (capped +3 min) so the stored minute is current as of sync; the card's client tick then composes correctly. | `d7d9092` |
| M4 | False "Goal" notification from a phantom score-count blip | A goal ping requires a **confirmed goal action** (`deriveLastGoal` match), not just an aggregate count increase. | `5115a3c` |
| M5 | Live minute frozen in goalless matches (Clock only moved on score entries) | Derive the minute from the **freshest running clock** across all entries, not `latestScored`. | `2e72986` |
| M6 | Duplicate goal + repeated/late kickoff notifications | Set-based inserts with `NOT EXISTS` + `ON CONFLICT` dedup on `(user, fixture, type, body)`; kickoff fires only on `upcoming→live`. | `99c3cf2`, `92d1c15` |

### Standing invariants we now enforce
- **A match with a live clock is never "finished."** (running-clock net)
- **Knockouts can't end level** — a finalise at a level score with no PE is ignored.
- **Goals require a confirmed goal action**, not an aggregate count delta.
- **`Confirmed === false` entries are skipped** everywhere (score, minute, goals, events).
- **`finished` is terminal in the DB** — once settled, a later sync can't un-finish a
  match (protects against flicker). Corollary: a *wrongly* finished match must be
  repaired manually — `node --env-file=.env scripts/unresolve-fixture.mjs <id>`
  (dry-run; `--apply` to execute). So our guards must stop a bad finish **before**
  it's written; the script is the recovery valve if one ever slips through.

---

## Section 3 — Open watch-list
- Abandoned match (StatusId 15) at a level score → `deriveLiveScore` returns finished
  with no winner → `normalizeFixture` folds a knockout back to "live" indefinitely.
  Rare; revisit if it occurs.
- Score regression: `latestScored` takes the highest-`Ts` confirmed entry regardless of
  whether its `Total` is lower than an earlier one — a late "correction" to a lower score
  is honoured. We only *notify* on increases, so this is display-only, but worth watching.
