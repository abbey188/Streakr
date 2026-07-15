import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, ArrowLeftRight, Play } from "lucide-react";
import type { Fixture, FeedItem } from "../types";
import { useNow, liveMinuteLabel } from "@/lib/live-clock";
import { kickoffLabel } from "@/lib/match-groups";
import { momentPhrase, momentTone } from "@/lib/social/moment";
import CountryFlag from "./CountryFlag";
import LineupModal from "./LineupModal";

/** Card time label — shows stoppage time ("45+2'") when the deriver set it. */
function minLabel(item: FeedItem): string {
  const custom = (item.payload as { min?: string }).min;
  if (custom) return `${custom}'`;
  if (item.minute != null) return `${item.minute}'`;
  return item.match.status === "finished" ? "FT" : "";
}

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
// Phrasing + tone come from the shared lib (lib/social/moment) so the feed card
// and the shared Squad Room card never drift.

interface MomentMeta { icon: string; label: string; tone: string; body: React.ReactNode; }

function momentMeta(item: FeedItem): MomentMeta {
  const m = item.match;
  const side = (item.payload as { side?: string }).side;
  const team = side === "A" ? m.teamA.name : side === "B" ? m.teamB.name : m.teamA.name;
  const ph = momentPhrase(item.type, item.payload, team);
  return {
    icon: ph.icon, label: ph.label, tone: momentTone(item.type),
    body: (
      <>
        {ph.subject ? <b className="text-white font-bold">{ph.subject}</b> : null}
        {ph.subject ? " " : null}{ph.predicate}
        {ph.context ? <span className="text-[#8E9299]"> · {ph.context}</span> : null}
      </>
    ),
  };
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
        {item.type === "momentum" ? <Activity className="w-4.5 h-4.5 text-[#FF4E00]" strokeWidth={2.5} />
          : item.type === "sub" ? <ArrowLeftRight className="w-4.5 h-4.5 text-[#5EC26A]" strokeWidth={2.5} />
          : meta.icon}
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
            {minLabel(item)}
          </span>
        </div>
        <div className="text-[12.5px] text-slate-200 mt-1 leading-snug">{meta.body}</div>
        {item.type === "momentum" && (() => {
          const p = item.payload as { side?: string; possA?: number; possB?: number };
          const pa = p.possA ?? 50, pb = p.possB ?? 50, leadA = p.side === "A";
          // Flipped bar: the bright (orange) fill sits on the side of whoever has
          // the momentum; the other team's share stays grey.
          return (
            <div className="mt-2">
              <div className="flex justify-between text-[8.5px] font-mono font-bold tabular-nums">
                <span className={leadA ? "text-[#FF4E00]" : "text-[#8E9299]"}>{m.teamA.code} {pa}%</span>
                <span className={!leadA ? "text-[#FF4E00]" : "text-[#8E9299]"}>{pb}% {m.teamB.code}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex mt-1 bg-[#2D364F]">
                <span className={`h-full ${leadA ? "bg-[#FF4E00]" : "bg-transparent"}`} style={{ width: `${pa}%` }} />
                <span className={`h-full ${!leadA ? "bg-[#FF4E00]" : "bg-transparent"}`} style={{ width: `${pb}%` }} />
              </div>
            </div>
          );
        })()}
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

// ─── match-state beat (kickoff / HT / FT / extra time / added time) ──────────
// Rendered as a centered timeline divider, not a shareable card — it's a state
// marker, not a moment to argue about.

function StateBeat({ item }: { item: FeedItem }) {
  const m = item.match;
  const p = item.payload as { kind?: string };
  const ph = momentPhrase(item.type, item.payload, m.teamA.name);
  const isFT = item.type === "status" && p.kind === "ft";
  const isKickoff = item.type === "status" && p.kind === "kickoff";
  const result = isFT && m.winner ? `${(m.winner === "A" ? m.teamA : m.teamB).code} through` : null;
  // Kickoff shows the fixture (its score isn't 0–0 by full-time); everything
  // else shows the score, which is meaningful at that beat.
  const context = isKickoff
    ? `${m.teamA.code} v ${m.teamB.code}`
    : item.type === "stoppage"
      ? ph.predicate
      : `${m.teamA.code} ${m.scoreA ?? 0}–${m.scoreB ?? 0} ${m.teamB.code}`;
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="flex-1 h-px bg-white/5" />
      <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-[#8E9299] whitespace-nowrap">
        {isKickoff ? <Play className="w-2.5 h-2.5 text-[#8E9299]" strokeWidth={3} fill="currentColor" /> : <span className="text-[11px]">{ph.icon}</span>}
        {ph.label}
        <span className="text-slate-400">· {context}</span>
        {result && <span className="text-[#FF4E00]">· {result}</span>}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ─── the Hub ─────────────────────────────────────────────────────────────────

export default function LiveFeed({ fixtures, feed, onOpenMatch, onShareMoment }: LiveFeedProps) {
  const now = useNow();
  const [lineupItem, setLineupItem] = useState<FeedItem | null>(null);

  const live = fixtures.filter((f) => f.status === "live");
  // The strip is a scoreboard glance for TODAY only — live matches + any still
  // to kick off today. Future fixtures live on Play, not here.
  const isToday = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const upcoming = fixtures
    .filter((f) => f.status === "upcoming" && isToday(f.kickoffAt))
    .sort((a, b) => (a.kickoffAt ? Date.parse(a.kickoffAt) : 0) - (b.kickoffAt ? Date.parse(b.kickoffAt) : 0));
  const strip = [...live, ...upcoming];
  // For the empty banner state: the soonest upcoming fixture on any day.
  const nextUp = fixtures
    .filter((f) => f.status === "upcoming")
    .sort((a, b) => (a.kickoffAt ? Date.parse(a.kickoffAt) : 0) - (b.kickoffAt ? Date.parse(b.kickoffAt) : 0))[0];

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-10">
      {/* Header + strip pinned together as ONE solid sticky block, so the strip
          never partially scrolls under the header (which left an empty card edge
          peeking out). */}
      <div className="sticky top-0 z-30 bg-[#0A0E1A]">
        <div className="border-b border-white/5 px-4 py-3.5">
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

        {/* Live strip — inside the sticky block, pinned with the header. Always
            present so the banner never collapses into the feed; shows a graceful
            state when there's nothing on today. */}
        {strip.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 no-scrollbar">
            {strip.map((f) => (
              <StripCard key={f.id} fixture={f} now={now} onOpen={() => onOpenMatch(f.id)} />
            ))}
          </div>
        ) : (
          <button
            onClick={nextUp ? () => onOpenMatch(nextUp.id) : undefined}
            className="w-full flex items-center gap-2 px-4 py-3 border-b border-white/5 text-left overflow-hidden"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8E9299] flex-shrink-0" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#8E9299] flex-shrink-0">No live matches</span>
            {nextUp && (
              <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono text-[#8E9299] min-w-0">
                <span className="uppercase tracking-wider flex-shrink-0">Next</span>
                <span className="font-bold text-slate-300 truncate">{nextUp.teamA.code} v {nextUp.teamB.code}</span>
                <span className="flex-shrink-0">· {kickoffLabel(nextUp)}</span>
              </span>
            )}
          </button>
        )}
      </div>

      {/* Moment feed */}
      <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
        {feed.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#8E9299] pl-1 pb-0.5">
              Latest
            </h3>
            {/* Layout-animated: a new moment fades/slides in at the top and the
                rest smoothly shift down, instead of the list hard-swapping. */}
            <AnimatePresence initial={false}>
              {feed.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {item.type === "status" || item.type === "stoppage" ? (
                    <StateBeat item={item} />
                  ) : item.type === "lineup" ? (
                    <MomentCard item={item} onOpen={() => setLineupItem(item)} />
                  ) : (
                    <MomentCard
                      item={item}
                      onOpen={() => onOpenMatch(item.fixtureId)}
                      onShare={onShareMoment ? () => onShareMoment(item) : undefined}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
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

      {lineupItem && <LineupModal item={lineupItem} onClose={() => setLineupItem(null)} />}
    </div>
  );
}
