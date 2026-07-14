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
  outcome?: string; penalty?: boolean; cardType?: string;
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
    case "var":
      return {
        icon: "📺",
        label: p.outcome === "overturned" ? "VAR · Overturned" : p.outcome === "stands" ? "VAR · Stands" : "VAR",
        predicate: p.outcome === "overturned" ? "The decision is overturned" : p.outcome === "stands" ? "After review, the decision stands" : "Under VAR review",
      };
    case "shot":
      return { icon: "🎯", label: p.outcome === "Woodwork" ? "Woodwork" : "Shot on target", subject: p.player ?? teamName, predicate: p.outcome === "Woodwork" ? "rattles the woodwork" : "forces a save" };
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
    default: return "text-[#8E9299] bg-white/5";
  }
}

/** Freeze a feed moment into the attachment stored on a squad message. */
export function buildMomentAttachment(item: FeedItem): MomentAttachment {
  const m = item.match;
  const side = (item.payload as Payload).side;
  const teamName = side === "A" ? m.teamA.name : side === "B" ? m.teamB.name : m.teamA.name;
  const ph = momentPhrase(item.type, item.payload, teamName);
  return {
    kind: "moment",
    fixtureId: item.fixtureId,
    type: item.type,
    icon: ph.icon,
    label: ph.label,
    text: momentText(ph),
    teamACode: m.teamA.code,
    teamBCode: m.teamB.code,
    teamAName: m.teamA.name,
    teamBName: m.teamB.name,
    scoreA: m.scoreA ?? 0,
    scoreB: m.scoreB ?? 0,
    minute: item.minute ?? null,
  };
}
