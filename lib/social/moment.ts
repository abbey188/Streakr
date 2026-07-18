import type { FeedItem, FeedMatch, MomentAttachment } from "@/src/types";

// ─── deterministic variety ───────────────────────────────────────────────────
// The feed should read like commentary, not a template — so we vary the phrasing.
// But the same moment must read the same on every refresh, so we pick a variant
// deterministically from a stable seed (the event key / fixture id), never at
// random. Same event → same words; different events → different words.
function seededHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function variant(options: string[], seed: string): string {
  return options[seededHash(seed) % options.length];
}

/**
 * A one-line, editorial match-end summary — derived deterministically from the
 * result (margin, period, winning-goal minute), NOT a fact. Gives full-time a
 * voice the incumbents don't have: "Argentina snatch it — a 90' winner sends
 * them past England, 2–1." null until we know who advanced.
 */
export function matchSummary(m: FeedMatch, lastGoalMin?: number): string | null {
  if (!m.winner) return null;
  const win = m.winner === "A" ? m.teamA : m.teamB;
  const lose = m.winner === "A" ? m.teamB : m.teamA;
  const winScore = (m.winner === "A" ? m.scoreA : m.scoreB) ?? 0;
  const loseScore = (m.winner === "A" ? m.scoreB : m.scoreA) ?? 0;
  const margin = winScore - loseScore;
  const period = (m.period ?? "").toUpperCase();
  const isFinal = /final/i.test(m.round) && !/semi|third/i.test(m.round);
  const isThird = /third/i.test(m.round);
  const dest = isFinal ? "are World Champions" : isThird ? "take third place" : "are through";
  const score = `${winScore}–${loseScore}`;
  const seed = m.fixtureId;

  if (period.includes("PEN")) {
    return variant(
      [
        `${win.name} hold their nerve from the spot — they ${dest}.`,
        `It goes the distance, but ${win.name} win the shootout — they ${dest}.`,
        `${win.name} keep their cool on penalties to knock out ${lose.name}.`,
      ],
      seed,
    );
  }
  const aet = period.includes("AET") || (period.includes("ET") && !period.includes("PEN"));

  // A goalless win only happens on penalties/AET; guard the score-based lines.
  if (margin === 0) {
    return `${win.name} outlast ${lose.name}${aet ? " after extra time" : ""} — they ${dest}.`;
  }

  // A late one-goal winner is the story — lean into it.
  if (margin === 1 && lastGoalMin != null && lastGoalMin >= 80 && !aet) {
    return variant(
      [
        `${win.name} snatch it — a ${lastGoalMin}' winner sends them past ${lose.name}, ${score}.`,
        `Drama late on: a ${lastGoalMin}'-minute strike wins it for ${win.name}, ${score}.`,
        `${win.name} break ${lose.name} hearts — a ${lastGoalMin}' goal, ${score}, and they ${dest}.`,
      ],
      seed,
    );
  }
  const tail = aet ? " after extra time" : "";
  if (margin >= 3) {
    return variant(
      [`${win.name} run riot — ${score} past ${lose.name}, and they ${dest}.`,
       `${win.name} tear ${lose.name} apart, ${score}${tail} — they ${dest}.`],
      seed,
    );
  }
  if (margin === 2) {
    return variant(
      [`${win.name} see off ${lose.name} ${score}${tail} — they ${dest}.`,
       `A composed ${score} for ${win.name}${tail}, and they ${dest}.`],
      seed,
    );
  }
  return variant(
    [`${win.name} edge ${lose.name} ${score}${tail} — they ${dest}.`,
     `${win.name} find a way past ${lose.name}, ${score}${tail} — they ${dest}.`,
     `Fine margins: ${win.name} take it ${score}${tail} and ${dest}.`],
    seed,
  );
}

// ─── goal commentary ─────────────────────────────────────────────────────────
// Reads the running score (sa/sb, AFTER the goal) to say what the goal DID —
// opened the scoring, levelled it, put them ahead, extended, or a consolation.
function goalLine(cls: string, teamName: string, seed: string): string {
  const bank: Record<string, string[]> = {
    opener: ["opens the scoring", "breaks the deadlock", "strikes first", "gets the opener"],
    goAhead: [`puts ${teamName} ahead`, `nudges ${teamName} in front`, `edges ${teamName} in front`, `fires ${teamName} ahead`],
    equaliser: ["levels it up", "draws it level", "hits back to equalise", "restores parity"],
    extend: ["extends the lead", "stretches it further", "turns the screw", "piles on the pressure"],
    consolation: ["pulls one back", `gets ${teamName} on the board`, "reduces the arrears"],
  };
  return variant(bank[cls] ?? ["finds the net"], seed);
}

/**
 * Shared moment phrasing + styling — the single source of truth for how a match
 * moment reads and looks, used by both the Live Feed card and the shared Squad
 * Room card (so they never drift). Objects for the machine feed (⚽ 🟨 🔁 📺);
 * faces stay reserved for humans.
 */

export interface MomentPhrase {
  icon: string;
  label: string;
  subject?: string;  // the player/team to emphasise (bold in the feed)
  predicate: string; // the rest of the line
  context?: string;  // e.g. the team a sub belongs to (muted)
}

type Payload = {
  side?: string; scorer?: string; player?: string; on?: string; off?: string;
  outcome?: string; penalty?: boolean; cardType?: string; keeper?: string;
  reviewType?: string; possA?: number; possB?: number;
  sa?: number; sb?: number; // running score AFTER this event (goals only)
};

/**
 * How a moment reads. Deterministic from (type, payload, team). `seed` (the
 * moment's stable key) drives the phrasing variety so the same moment always
 * reads the same, but different moments don't sound copy-pasted.
 */
export function momentPhrase(type: string, payload: Record<string, unknown>, teamName: string, seed = ""): MomentPhrase {
  const p = payload as Payload;
  switch (type) {
    case "goal":
    case "penalty": {
      const isPen = type === "penalty" || p.penalty === true;
      const subject = p.scorer ?? teamName;
      // Classify the goal from the running score (AFTER the strike) so the words
      // describe what it did to the game, not just "scores".
      let predicate: string;
      if (typeof p.sa === "number" && typeof p.sb === "number" && (p.side === "A" || p.side === "B")) {
        const scorerAfter = p.side === "A" ? p.sa : p.sb;
        const otherAfter = p.side === "A" ? p.sb : p.sa;
        const scorerBefore = scorerAfter - 1;
        let cls: string;
        if (scorerBefore === 0 && otherAfter === 0) cls = "opener";
        else if (scorerAfter === otherAfter) cls = "equaliser";
        else if (scorerBefore === otherAfter) cls = "goAhead";
        else if (scorerAfter > otherAfter) cls = "extend";
        else cls = "consolation";
        predicate = goalLine(cls, teamName, seed || `${p.side}${scorerAfter}${otherAfter}`);
      } else {
        predicate = isPen ? "converts from the spot" : p.scorer ? "finds the net" : "find the net";
      }
      return { icon: "⚽", label: isPen ? "Penalty" : "Goal", subject, predicate, context: isPen ? "from the spot" : undefined };
    }
    case "penalty_missed":
      return { icon: "🥅", label: "Penalty", subject: p.player ?? teamName, predicate: `sees the penalty ${p.outcome ?? "saved"}` };
    case "yellow":
      return { icon: "🟨", label: "Yellow card", subject: p.player ?? teamName,
        predicate: variant(["goes into the book", "is booked", "picks up a yellow", "is cautioned"], seed) };
    case "red":
      return { icon: "🟥", label: "Red card", subject: p.player ?? teamName, predicate: p.cardType === "SecondYellow" ? "sent off — second yellow" : "is shown red" };
    case "sub":
      return p.on
        ? { icon: "🔁", label: "Substitution", subject: p.on, predicate: p.off ? `on, ${p.off} off` : "on", context: teamName }
        : { icon: "🔁", label: "Substitution", subject: p.off ?? "Change", predicate: "off", context: teamName };
    case "var": {
      const label = p.outcome === "overturned" ? "VAR · Overturned" : p.outcome === "stands" ? "VAR · Stands" : "VAR";
      const noun = p.reviewType === "Goal" ? "goal" : p.reviewType === "Penalty" ? "penalty" : p.reviewType === "RedCard" ? "red card" : null;
      let predicate: string;
      if (p.reviewType === "MistakenIdentity") predicate = "VAR corrects a mistaken identity";
      else if (p.outcome === "overturned") predicate = noun ? `The ${noun} is overturned by VAR` : "The decision is overturned by VAR";
      else if (p.outcome === "stands") predicate = noun ? `The ${noun} stands after VAR` : "After review, the decision stands";
      else predicate = "Under VAR review";
      return { icon: "📺", label, predicate };
    }
    case "shot":
      if (p.outcome === "Woodwork")
        return { icon: "🎯", label: "Woodwork", subject: p.player ?? teamName,
          predicate: variant(["rattles the woodwork", "strikes the post", "clips the bar"], seed) };
      return { icon: "🎯", label: "Shot on target", subject: p.player ?? teamName,
        predicate: p.keeper
          ? variant([`forces ${p.keeper} into a save`, `tests ${p.keeper}`, `stings the gloves of ${p.keeper}`, `brings a save out of ${p.keeper}`], seed)
          : variant(["forces a save", "tests the keeper", "goes close"], seed) };
    case "lineup":
      return { icon: "📋", label: "Lineups", predicate: "Both XIs are in — tap for the roster" };
    case "momentum": {
      const lead = Math.max(p.possA ?? 0, p.possB ?? 0);
      const predicate = lead >= 75 ? "camped in the other half"
        : lead >= 68 ? "in total control"
        : lead >= 63 ? "turning the screw"
        : "building the pressure";
      return { icon: "📊", label: "Momentum", subject: teamName, predicate };
    }
    case "status": {
      const kind = (payload as { kind?: string }).kind;
      const m: Record<string, { icon: string; label: string; predicate: string }> = {
        kickoff: { icon: "⏱️", label: "Kick-off", predicate: "We're under way" },
        ht: { icon: "⏸️", label: "Half-time", predicate: "It's the half-time whistle" },
        secondhalf: { icon: "▶️", label: "Second half", predicate: "Back under way" },
        ft: { icon: "🏁", label: "Full-time", predicate: "Full-time" },
        et: { icon: "⏳", label: "Extra time", predicate: "Still level — we go to extra time" },
        pens: { icon: "🥅", label: "Penalties", predicate: "It's going to a shootout" },
      };
      const s = m[kind ?? ""] ?? { icon: "⏱️", label: "Update", predicate: "" };
      return { icon: s.icon, label: s.label, predicate: s.predicate };
    }
    case "stoppage": {
      const mins = (payload as { minutes?: number }).minutes ?? 0;
      return { icon: "⏱️", label: "Added time", predicate: `${mins} ${mins === 1 ? "minute" : "minutes"} added` };
    }
    case "corner":
      return { icon: "🚩", label: "Corner", subject: teamName,
        predicate: variant(["win a corner", "force a corner", "earn a corner", "swing one in from the corner"], seed) };
    case "freekick":
      return { icon: "🧱", label: "Free kick", subject: teamName,
        predicate: (payload as { dangerous?: boolean }).dangerous ? "win a dangerous free kick" : "win a free kick" };
    default:
      return { icon: "•", label: type, predicate: teamName };
  }
}

/** Flatten a phrase to plain text (for the frozen attachment + notifications). */
export function momentText(ph: MomentPhrase): string {
  return [ph.subject, ph.predicate].filter(Boolean).join(" ") + (ph.context ? ` · ${ph.context}` : "");
}

/** Badge colour classes per moment type — shared so feed + chat card match. */
export function momentTone(type: string): string {
  switch (type) {
    case "goal": case "penalty": return "text-emerald-400 bg-emerald-500/15";
    case "penalty_missed": return "text-slate-300 bg-white/5";
    case "yellow": return "text-amber-400 bg-amber-500/15";
    case "red": return "text-red-400 bg-red-500/15";
    case "sub": return "text-[#5EC26A] bg-[#5EC26A]/15";
    case "var": return "text-purple-300 bg-purple-500/15";
    case "shot": return "text-sky-400 bg-sky-500/15";
    case "momentum": return "text-[#FF4E00] bg-[#FF4E00]/15";
    case "corner": case "freekick": return "text-slate-300 bg-white/8"; // low-weight
    case "lineup": return "text-slate-300 bg-white/8";
    default: return "text-[#8E9299] bg-white/5";
  }
}

/** Freeze a feed moment into the attachment stored on a squad message. */
export function buildMomentAttachment(item: FeedItem): MomentAttachment {
  const m = item.match;
  const side = (item.payload as Payload).side;
  const teamName = side === "A" ? m.teamA.name : side === "B" ? m.teamB.name : m.teamA.name;
  const ph = momentPhrase(item.type, item.payload, teamName, item.eventKey);
  // Momentum has no visual bar in chat, so fold the possession % into the text.
  let text = momentText(ph);
  if (item.type === "momentum") {
    const p = item.payload as { possA?: number; possB?: number };
    text = `${teamName} ${ph.predicate} · ${Math.max(p.possA ?? 0, p.possB ?? 0)}% momentum`;
  }
  return {
    kind: "moment",
    fixtureId: item.fixtureId,
    type: item.type,
    icon: ph.icon,
    label: ph.label,
    text,
    teamACode: m.teamA.code,
    teamBCode: m.teamB.code,
    teamAName: m.teamA.name,
    teamBName: m.teamB.name,
    scoreA: m.scoreA ?? 0,
    scoreB: m.scoreB ?? 0,
    minute: item.minute ?? null,
  };
}
