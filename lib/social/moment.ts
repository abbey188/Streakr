import type { FeedItem, MomentAttachment } from "@/src/types";

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
};

/** How a moment reads. Deterministic from (type, payload, team). */
export function momentPhrase(type: string, payload: Record<string, unknown>, teamName: string): MomentPhrase {
  const p = payload as Payload;
  switch (type) {
    case "goal":
      return p.scorer
        ? { icon: "⚽", label: p.penalty ? "Penalty" : "Goal", subject: p.scorer, predicate: p.penalty ? "converts from the spot" : "finds the net" }
        : { icon: "⚽", label: p.penalty ? "Penalty" : "Goal", subject: teamName, predicate: p.penalty ? "score from the spot" : "score" };
    case "penalty":
      return { icon: "⚽", label: "Penalty", subject: p.scorer ?? teamName, predicate: "scores from the spot" };
    case "penalty_missed":
      return { icon: "🥅", label: "Penalty", subject: p.player ?? teamName, predicate: `sees the penalty ${p.outcome ?? "saved"}` };
    case "yellow":
      return { icon: "🟨", label: "Yellow card", subject: p.player ?? teamName, predicate: "goes into the book" };
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
        return { icon: "🎯", label: "Woodwork", subject: p.player ?? teamName, predicate: "rattles the woodwork" };
      return { icon: "🎯", label: "Shot on target", subject: p.player ?? teamName,
        predicate: p.keeper ? `forces ${p.keeper} into a save` : "forces a save" };
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
      return { icon: "🚩", label: "Corner", subject: teamName, predicate: "win a corner" };
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
  const ph = momentPhrase(item.type, item.payload, teamName);
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
