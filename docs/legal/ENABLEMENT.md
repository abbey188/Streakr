# Legal — Enablement Checklist (parked, ready to switch on)

Status: **built and typecheck-clean, NOT yet deployed or linked in the UI.**
This doc is everything needed to turn it on later. No code needs writing — it's
fill-in + wire-up + deploy.

## What already exists

| File | What it is |
|---|---|
| `app/privacy/page.tsx` | Public **Privacy Policy** page → `/privacy` (GDPR-grade, real sub-processors) |
| `app/terms/page.tsx` | Public **Terms of Service** page → `/terms` (free play + sponsored cash-prize tournaments, cosmetics, conduct, not-gambling framing) |
| `src/components/legal/LegalDoc.tsx` | Shared page chrome (dark theme, back link, sections) |
| `src/components/legal/legalConfig.ts` | **Single source of truth** for the fill-in details |
| `docs/legal/TOURNAMENT_OFFICIAL_RULES_TEMPLATE.md` | Per-tournament rules template (fill per sponsor cash-prize event) |

The routes are public (outside the authed `(app)` group), so they work
signed-out. They already cross-link each other and back to `/`.

## To switch on — 4 steps

### 1. Fill the 4 placeholders in `src/components/legal/legalConfig.ts`
- `operator` — legal entity or individual operating Streakr (e.g. "Streakr Ltd").
- `contactEmail` — monitored legal/support address (a Gmail is fine until the
  custom domain lands; update later).
- `privacyEmail` — can equal `contactEmail`.
- `governingLaw` — the jurisdiction whose law governs the Terms (pick one even
  though the audience is global — e.g. "England & Wales").

Also bump `effectiveDate` / `lastUpdated` when you publish.

### 2. Wire the UI (small change to designed screens — needs sign-off)
- Add **"Terms · Privacy"** links to the landing/footer.
- Add a one-liner under the sign-in button: *"By continuing you agree to our
  Terms & Privacy Policy."* (records consent at signup).
- Recommended: an **18+ confirmation** at signup (cash prizes ⇒ 18+).

### 3. Deploy
New files + the config fill → commit → push to `main` (Vercel auto-builds).
`/privacy` and `/terms` go live immediately.

### 4. Before running any CASH-PRIZE tournament
- Copy `TOURNAMENT_OFFICIAL_RULES_TEMPLATE.md`, fill every `{{placeholder}}`,
  publish it, and link it from the tournament screen.
- **Have a lawyer review** the tournament rules for your target territories.
  Cash prizes = sweepstakes/skill-contest rules that vary by country/state.

## Important caveats
- These documents are strong, tailored **starting points — not legal advice.**
  Get a qualified lawyer to review before relying on them, *especially* the
  prize-tournament mechanics for a global audience.
- Everyday **free play is low legal risk**; **cash prizes** are where counsel
  matters most.
- Data-compliance posture baked in: GDPR-grade privacy, 18+ age intent, accurate
  sub-processor list, deletion-rights path. Keep `subProcessors` in
  `legalConfig.ts` accurate as the stack changes (e.g. when ads/analytics land).

## Open follow-ups (tracked separately)
- Claims audit of user-facing copy ("verified on-chain", any "win"/prize
  language, launch messaging) for accuracy vs. these terms.
- Account-deletion self-serve flow (supports the "right to erasure" promise).
- Cookie/consent banner *if/when* analytics or advertising is added.
