# Streakr — Global Compliance Posture

_Last reviewed: 5 July 2026. Plain-English internal memo — **not legal advice.**_
_Get a lawyer to review before you turn on payments or scale materially._

Streakr is a **free** football-prediction game (streaks, points, badges, leaderboards),
soon adding a **social feed / Reddit-style timeline**, and **later** optional
**direct-purchase cosmetic** items. This memo is how we stand for **worldwide** use.

---

## ✅ Handled by design (you're in good shape here)

| Area | What we do | Where |
|---|---|---|
| **Privacy rights (GDPR / UK GDPR / CCPA / LGPD / etc.)** | Access, correct, delete, port, object, withdraw consent — all offered, with a contact address. Covers most of the world via one "your rights depending on where you live" section. | `/privacy` §9 |
| **Right to erasure** | Real self-serve deletion: Settings → Delete Account wipes DB + Privy identity. Not just a promise. | App + `/privacy` §7 |
| **Sub-processor transparency** | Every third party that touches user data is listed with purpose + link. Regulators expect this. | `/privacy` §5 |
| **Consent at signup** | Passive clickwrap ("By continuing you agree to Terms & Privacy") with links, shown before account creation. | Signup screen |
| **Not gambling** | No cash prizes, no paid entry, no wagering, no cash-out, **no randomised loot boxes**. Cosmetics are cosmetic-only and never affect ranking. This keeps us out of gambling law everywhere. | `/terms` §4–5 |
| **Age** | 13+ minimum (the global floor; matches US COPPA and most of the world). Under-majority users need a guardian. | `/terms` §1, `/privacy` §11 |
| **International transfers** | We acknowledge global processing (incl. US) and rely on SCCs / lawful mechanisms. | `/privacy` §6 |
| **Security** | Encryption of sensitive credentials, HTTPS, access controls, stated honestly. | `/privacy` §10 |
| **UGC framework (ready for the social feed)** | Prohibited-content rules, public-visibility warning, a reporting address, moderation rights, and an IP/DMCA-style takedown process — all in place before the feed ships. | `/terms` §7 |
| **Consumer purchase law (ready for cosmetics)** | Direct-purchase only, prices shown, no card storage, EU/UK 14-day withdrawal waiver for instantly-delivered digital content, mandatory consumer rights preserved. | `/terms` §5, §14 |
| **Sanctions** | Restricted-territory / restricted-parties exclusion clause. | `/terms` §1 |

---

## ⚠️ To do as you grow (not launch blockers, but real)

1. **EU / UK GDPR representative (Article 27).** A non-EU/UK operator that *targets* EU/UK
   users technically needs a local "representative." Widely deferred by small/early apps, but
   it's a genuine obligation once you actively target or get real EU traffic. Cheap services
   exist (~€/£ a few hundred a year). **Action: revisit once you have meaningful EU users.**

2. **Cookie-consent banner — only when you add analytics/ads.** Right now we use *strictly
   necessary* cookies only (Privy login session), which need no banner. The moment you add
   Google Analytics, Meta Pixel, ads, etc., EU/UK law requires a consent banner **before** they
   load. **Action: add a banner at the same time you add any non-essential tracking.** (The
   Privacy Policy already promises this.)

3. **Digital Services Act (DSA) — kicks in with the social feed.** Once you host user posts/
   comments in the EU you're an "online platform." The basics (notice-and-action, a reporting
   channel, acting on illegal content) are **already built into Terms §7**. The heavier duties
   (transparency reports, trusted flaggers, appeals) only bite at scale (45M+ EU users = "VLOP").
   **Action: keep the reporting inbox monitored; formalise moderation logging as you grow.**

4. **Age-of-consent variance in the EU.** GDPR lets each member state set the data-consent age
   between **13 and 16**. We use 13 (the floor) with a guardian-consent note. Fine for launch;
   tighten if you market heavily to minors in high-threshold countries (e.g. Germany = 16).

5. **Payments & tax — when you actually monetise.** Global VAT/sales-tax is the single biggest
   headache for a solo operator. **Strong recommendation: use a Merchant-of-Record** (Paddle or
   Lemon Squeezy) so *they* are the legal seller and collect/remit tax in every country for you.
   Avoid raw Stripe unless you're ready to register for VAT/OSS yourself. **Action: pick a MoR
   before the first sale; add it to the sub-processor list and name it in Terms §5.**

6. **Keep cosmetics direct-purchase (no loot boxes).** The Terms commit to this. Paid randomised
   boxes are treated as **gambling in Belgium and the Netherlands** and need odds disclosure
   elsewhere. Staying direct-purchase keeps you clean everywhere. **Action: don't ship paid
   randomised mechanics without legal review.**

7. **Lawyer review before scaling / before payments.** These docs are strong, tailored starting
   points — not a substitute for counsel, especially once money changes hands.

---

## TL;DR

For a **free game with a social feed**, you're in a solid, defensible position worldwide **today** —
the privacy rights, deletion, consent, moderation framework, and no-gambling posture are all in
place. The items above are **scale-triggered**, not launch blockers. The two that need a real
decision *before* the relevant feature ships are: **(a) a Merchant-of-Record for payments**, and
**(b) keeping cosmetics direct-purchase.** Both are already reflected in the Terms.
