import React from "react";
import type { Fixture, FeedItem, FeedMatch } from "../types";
import { useNow, liveMinuteLabel } from "@/lib/live-clock";
import { kickoffLabel } from "@/lib/match-groups";
import CountryFlag from "./CountryFlag";

/**
 * The Hub, reimagined (docs/social/LIVE_FEED.md): a clean live-scores strip on
 * top, then a scrollable feed of match moments (goal/card/sub/VAR/shot) powered
 * by TxLINE via /api/feed. The strip stays plain — same card as everywhere, just
 * a live dot; all the richness lives in the feed. Every moment names the player
 * and taps through to the match. Share-to-squad wires in Phase 4.
 */

interface LiveFeedProps {
  fixtures: Fixture[];
  feed: FeedItem[];
  onOpenMatch: (fixtureId: string) => void;
  onShareMoment?: (item: FeedItem) => void;
}

// ─── moment vocabulary ───────────────────────────────────────────────────────
// Objects for the machine feed (⚽ 🟨 🔁 📺); faces stay reserved for humans.

interface MomentMeta {
  icon: string;
  label: string;
  tone: string; // badge colour classes
  body: React.ReactNode;
}

const teamName = (m: FeedMatch, side?: string) =>
  side === "A" ? m.teamA.name : side === "B" ? m.teamB.name : m.teamA.name;

function momentMeta(item: FeedItem): MomentMeta {
  const p = item.payload as {
    side?: string; scorer?: string; player?: string; on?: string; off?: string;
    outcome?: string; penalty?: boolean; cardType?: string;
  };
  const m = item.match;
  const team = teamName(m, p.side);
  const b = (s?: string) => <b className="text-white font-bold">{s}</b>;

  switch (item.type) {
    case "goal":
      return {
        icon: "⚽", label: p.penalty ? "Penalty" : "Goal",
        tone: "text-emerald-400 bg-emerald-500/15",
        body: p.scorer
          ? <>{b(p.scorer)} {p.penalty ? "converts from the spot" : "finds the net"}</>
          : <>{b(team)} {p.penalty ? "score from the spot" : "score"}</>,
      };
    case "penalty":
      return {
        icon: "⚽", label: "Penalty",
        tone: "text-emerald-400 bg-emerald-500/15",
        body: <>{b(p.scorer ?? team)} scores from the spot</>,
      };
    case "penalty_missed":
      return {
        icon: "🥅", label: "Penalty",
        tone: "text-slate-300 bg-white/5",
        body: <>{b(p.player ?? team)} sees the penalty {p.outcome ?? "saved"}</>,
      };
    case "yellow":
      return {
        icon: "🟨", label: "Yellow card",
        tone: "text-amber-400 bg-amber-500/15",
        body: <>{b(p.player ?? team)} goes into the book</>,
      };
    case "red":
      return {
        icon: "🟥", label: "Red card",
        tone: "text-red-400 bg-red-500/15",
        body: <>{b(p.player ?? team)} {p.cardType === "SecondYellow" ? "sent off — second yellow" : "is shown red"}</>,
      };
    case "sub":
      return {
        icon: "🔁", label: "Substitution",
        tone: "text-[#5EC26A] bg-[#5EC26A]/15",
        body: p.on
          ? <>{b(p.on)} on{p.off ? <>, {p.off} off</> : null} <span className="text-[#8E9299]">· {team}</span></>
          : <>{b(p.off ?? "Change")} off <span className="text-[#8E9299]">· {team}</span></>,
      };
    case "var":
      return {
        icon: "📺",
        label: p.outcome === "overturned" ? "VAR · Overturned" : p.outcome === "stands" ? "VAR · Stands" : "VAR",
        tone: "text-purple-300 bg-purple-500/15",
        body: p.outcome === "overturned"
          ? <>The decision is <b className="text-white">overturned</b></>
          : p.outcome === "stands"
            ? <>After review, the <b className="text-white">decision stands</b></>
            : <>Under VAR review</>,
      };
    case "shot":
      return {
        icon: "🎯", label: p.outcome === "Woodwork" ? "Woodwork" : "Shot on target",
        tone: "text-sky-400 bg-sky-500/15",
        body: p.outcome === "Woodwork"
          ? <>{b(p.player ?? team)} rattles the woodwork</>
          : <>{b(p.player ?? team)} forces a save</>,
      };
    default:
      return { icon: "•", label: item.type, tone: "text-[#8E9299] bg-white/5", body: <>{team}</> };
  }
}

// ─── strip ───────────────────────────────────────────────────────────────────

function StripCard({ fixture, now, onOpen }: { fixture: Fixture; now: number; onOpen: () => void }) {
  const isLive = fixture.status === "live";
  return (
    <button
      onClick={onOpen}
      className="flex-shrink-0 w-[158px] bg-[#151B2E] border border-white/5 rounded-2xl px-3 py-2.5 text-left transition hover:border-white/15 active:scale-[0.98]"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-[#8E9299]"}`} />
        <span className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-[#8E9299]">
          {isLive ? "Live" : "Kicks off"}
        </span>
        <span className="ml-auto text-[8.5px] font-mono text-[#8E9299] tabular-nums">
          {isLive ? liveMinuteLabel(fixture, now) : kickoffLabel(fixture)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <CountryFlag name={fixture.teamA.name} className="w-4 h-3 flex-shrink-0" />
          <span className="text-[11px] font-black italic tracking-tight truncate">{fixture.teamA.code}</span>
        </span>
        <span className="text-[13px] font-mono font-bold tabular-nums text-white">
          {isLive ? `${fixture.scoreA ?? 0}–${fixture.scoreB ?? 0}` : "v"}
        </span>
        <span className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="text-[11px] font-black italic tracking-tight truncate">{fixture.teamB.code}</span>
          <CountryFlag name={fixture.teamB.name} className="w-4 h-3 flex-shrink-0" />
        </span>
      </div>
    </button>
  );
}

// ─── moment card ─────────────────────────────────────────────────────────────

function MomentCard({ item, onOpen, onShare }: { item: FeedItem; onOpen: () => void; onShare?: () => void }) {
  const meta = momentMeta(item);
  const m = item.match;
  return (
    <div
      onClick={onOpen}
      className="flex gap-3 items-start bg-[#151B2E] border border-white/5 rounded-2xl p-3 transition hover:border-white/12 active:scale-[0.995] cursor-pointer"
    >
      <div className="w-9 h-9 rounded-xl flex-shrink-0 grid place-items-center text-[17px] bg-[#0A0E1A] border border-white/5">
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.tone}`}>
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 tabular-nums">
            <CountryFlag name={m.teamA.name} className="w-3.5 h-2.5" />
            {m.teamA.code} {m.scoreA ?? 0}–{m.scoreB ?? 0} {m.teamB.code}
            <CountryFlag name={m.teamB.name} className="w-3.5 h-2.5" />
          </span>
          <span className="ml-auto text-[9px] font-mono text-[#8E9299] tabular-nums">
            {item.minute != null ? `${item.minute}'` : m.status === "finished" ? "FT" : ""}
          </span>
        </div>
        <div className="text-[12.5px] text-slate-200 mt-1 leading-snug">{meta.body}</div>
        {onShare && (
          <div className="mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="inline-flex items-center gap-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wide text-[#FF4E00] bg-[#FF4E00]/10 border border-[#FF4E00]/25 rounded-full px-2.5 py-1 hover:bg-[#FF4E00]/20 transition"
            >
              ↗ Share to squad
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── the Hub ─────────────────────────────────────────────────────────────────

export default function LiveFeed({ fixtures, feed, onOpenMatch, onShareMoment }: LiveFeedProps) {
  const now = useNow();

  const live = fixtures.filter((f) => f.status === "live");
  // Next-up: soonest upcoming knockout fixtures, so the strip is never empty
  // between matches (and Play remains where you actually pick).
  const upcoming = fixtures
    .filter((f) => f.status === "upcoming")
    .sort((a, b) => (a.kickoffAt ? Date.parse(a.kickoffAt) : 0) - (b.kickoffAt ? Date.parse(b.kickoffAt) : 0))
    .slice(0, 4);
  const strip = [...live, ...upcoming];

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 bg-[#0A0E1A]/90 backdrop-blur-md border-b border-white/5 px-4 py-3.5 z-30">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-black italic tracking-tighter uppercase text-white">Hub</h2>
          {live.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[8.5px] font-mono font-bold uppercase tracking-widest text-[#8E9299]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {live.length} Live
            </span>
          )}
          <span className="ml-auto text-[8px] font-mono uppercase tracking-widest text-[#8E9299]">
            Powered by <span className="text-[#FF4E00] font-bold">TxLINE</span>
          </span>
        </div>
      </div>

      {/* Live strip */}
      {strip.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 no-scrollbar">
          {strip.map((f) => (
            <StripCard key={f.id} fixture={f} now={now} onOpen={() => onOpenMatch(f.id)} />
          ))}
        </div>
      )}

      {/* Moment feed */}
      <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
        {feed.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#8E9299] pl-1 pb-0.5">
              Latest
            </h3>
            {feed.map((item) => (
              <MomentCard
                key={item.id}
                item={item}
                onOpen={() => onOpenMatch(item.fixtureId)}
                onShare={onShareMoment ? () => onShareMoment(item) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 text-center px-6">
            <div className="text-3xl mb-3">📡</div>
            <p className="text-sm font-black italic text-slate-200">The feed lights up at kickoff</p>
            <p className="text-xs text-[#8E9299] mt-1.5 leading-relaxed">
              Every goal, card, sub and VAR call lands here live — straight from TxLINE.
              {upcoming[0] && (
                <> Next up: <span className="text-slate-300 font-bold">{upcoming[0].teamA.code} v {upcoming[0].teamB.code}</span>, {kickoffLabel(upcoming[0])}.</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
