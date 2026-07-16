# TxLINE / TxODDS Feed — Anomaly & Handling Log

Living log of quirks we've observed in the live TxLINE soccer feed (World Cup 2026),
how each one hit Streakr, and how we defended against it. **Section 1** is written to
hand to the TxLINE team as feedback. **Section 2** records our own mitigations so we
don't re-derive them. Newest first within each section.

Data path for reference: `getScoresSnapshot` (latest state per action) + `getScoresUpdates`
(the full, retransmitting action log) → `deriveLiveScore` / `deriveGoals` /
`deriveMatchEvents` / `deriveMomentum` (`lib/txline/normalize.ts`) → sync
(`lib/txline/sync.ts`) → notifications (`lib/db/live-notify.ts`) + resolution
(`lib/db/resolution.ts`) + the Live Feed (`match_events` → `/api/feed` → the Hub).

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

**Confirmed context (TxLINE release, 3 Jul 2026):** "all `action=game_finalised` in
Scores will have `statusId`/period 100." So 100 as a property of `game_finalised` is
**intended** — this report is specifically that 100 **leaked onto a `disconnected`
action**, which the release does not sanction. Our fix aligns with the intended
semantics: finalisation is keyed off the `game_finalised` **action**, never a bare 100.

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

### A4 — The same goal is emitted twice under **different `Seq`**, only one copy carrying `PlayerId`  ⚠️ HIGH
**Observed:** 16 Jul 2026, across **8/8 goals in 3 knockout fixtures** (England v
Argentina, France v Spain, Argentina v Switzerland). Grouping confirmed `goal` actions by
the scoring side's running `Score.*.Total.Goals` (i.e. one logical goal) gives, every
time, exactly **two** entries with **different `Seq`**, of which exactly **one** carries
`Data.PlayerId`:

```
England v Argentina   A:1  entries=2  seqs=[540,542]    withPlayerId=1/2
                      B:1  entries=2  seqs=[831,832]    withPlayerId=1/2
France v Spain        B:2  entries=2  seqs=[618,620]    withPlayerId=1/2
Argentina v Switz.    A:3  entries=2  seqs=[1282,1284]  withPlayerId=1/2
```

**Why it matters:** `Seq` reads like a stable per-action identity, so it's the natural
idempotency/dedup key for a consumer persisting events. But because the enriched (named)
copy arrives under a **different `Seq`**, any consumer keyed on `Seq` **double-inserts
every goal** — once anonymous, once with the scorer. This is not an edge case: it was
100% of goals observed.

**Ask:** Either (a) re-send the enriched copy under the **same `Seq`** as the original
action, or (b) expose an explicit stable action id that survives enrichment, or (c)
document that `Seq` is a **transmission counter, not an action identity**, so consumers
know not to key on it. (b) would be the most useful.

---

### A5 — A goal's own strike also arrives as a separate `shot` with `Outcome: OnTarget`  ⚠️ MED
**Observed:** 16 Jul 2026. Cross-referencing derived `goal` events against `shot`/
`OnTarget` events by (team, minute) yields **2–4 collisions per fixture** (Norway v
England: 4; England v Argentina: 2) — i.e. the shot that scored is *also* reported as a
shot on target.

**Why it matters:** A consumer rendering both surfaces the same strike twice — "X scores"
and "X forces a save" at the same minute — and shot-on-target counts are inflated (our
count fell 10 → 6 once deduped).

**Ask:** Mark the shot that resulted in the goal (e.g. `Outcome: "Goal"`, or a reference
to the goal action) so consumers can exclude it, instead of needing a (team, minute)
heuristic that can misfire when a real save happens in the same minute as a goal.

---

### A6 — Phase `StatusId` rides on non-`status` entries, so it can't be read as a transition  ⚠️ MED
**Observed:** 16 Jul 2026. Taking the first entry carrying `StatusId: 2` (first half) in
`Seq` order returns an entry whose `Clock.Seconds` ≈ 48 min — a first-half StatusId
attached to an entry deep in first-half stoppage, not to kick-off. Deriving "kick-off
happened here" from the first `StatusId 2` therefore produced a kick-off beat at **48'**.

**Why it matters:** Consumers deriving phase *transitions* from `StatusId` get bogus
transition timestamps, and (together with A1) a phase that appears to move **backwards**
when a stray status rides on a coverage/transport action.

**Ask:** Confirm whether `StatusId` on a non-`status` action means "the phase current at
transmission" (a property) rather than "a transition occurred here" (an event). If so,
please document it — and ideally emit phase transitions only on the `status` action.

---

### A7 — Lineups: `rosterNumber` inconsistently populated; `positionId` undocumented  ⚠️ LOW
**Observed:** 16 Jul 2026. The `Lineups` block's `positionId` and `starter` are reliable,
and `positionId` maps consistently (34=GK, 35=DEF, 36=MID, 37=FWD — **inferred**, since
France's only `34` was Maignan). But `rosterNumber` is populated for some fixtures and
**null for every player** in others (England v Argentina: all null; a France snapshot:
populated). Multiple `Lineups` snapshots also appear within one stream at differing
completeness.

**Ask:** (a) Populate `rosterNumber` consistently — jersey numbers are table-stakes for a
lineup UI, and we currently render "–" when absent. (b) **Document the `positionId`
values**, so consumers don't have to infer that 34 = goalkeeper (we need that to name the
keeper on a save).

---

### A8 — No venue/stadium/city, and `weather` is coarse  (feature request, not a bug)
**Observed:** 16 Jul 2026. `venue` carries only `Data.Type` (e.g. `"neutral"`); `weather`
carries `Data.Conditions` (e.g. `["Day"]`); `pitch` carries `Data.Conditions` (e.g.
`["Excellent"]`). There is no stadium name, city, geo, or temperature anywhere in the
fixtures or scores payloads.

**Ask:** Expose stadium name + city at the fixture level, and richer weather (condition +
temperature). Pre-match context ("MetLife Stadium · East Rutherford · 24°") is a natural
fan-facing surface we designed and had to drop for lack of data.

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
| M7 | Every goal double-inserted when keyed on `Seq` (**A4**) | Persist feed moments on a **stable content key**, never the raw `Seq`. Goals key on the scoring side's running goal count (`goal:A:2`) — identical for the anonymous and named copies, so the named one **updates the same row**. Cards/subs/shots key on (type, side, minute[, id]). | `3848047` |
| M8 | A goal also rendered as "forces a save" (**A5**) | Drop `shot`/`OnTarget` events that collide with a goal by the same side within ±1 min, so a goal never doubles as a save beat. | `4369894` |
| M9 | Kick-off beat derived at 48'; phase could regress (**A6**) | Advance the phase **monotonically** over StatusId 1..13 (never backwards, 100 excluded); emit a state beat only the first time a phase is reached. | `a828223` |
| M10 | Lineup jersey numbers missing / partial snapshots (**A7**) | Choose the `Lineups` snapshot with the **most `rosterNumber`s populated**; render "–" where still absent. Keeper resolved via `positionId 34`. | `6eb1fee` |

### Standing invariants we now enforce
- **Never key persisted state on `Seq`** — it is a transmission counter, not an action
  identity (A4). Anything we store keys on a derived stable content key, so re-deriving
  the full log every poll upserts instead of duplicating (and a cron gap self-heals).
- **Phase only advances, never regresses** — a stray StatusId on a coverage action can't
  rewind the match (A1/A6).
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
