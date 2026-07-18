import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Tv, Plus } from "lucide-react";
import EventIcon from "./EventIcon";
import { useAppState } from "@/lib/state/app-state";
import { SQUAD_REACTIONS } from "@/lib/social/reactions";
import type { Fixture, FeedItem } from "../types";
import { useNow, liveMinuteLabel } from "@/lib/live-clock";
import { kickoffLabel, kickoffWhen, kickoffDay, isTodayFixture } from "@/lib/match-groups";
import { momentPhrase, momentTone, matchSummary } from "@/lib/social/moment";
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
  const ph = momentPhrase(item.type, item.payload, team, item.eventKey);
  // Free kicks are colour-coded by threat: a dangerous one (TxLINE's Danger tag)
  // pops orange; a routine one stays quiet in soft grey.
  const tone = item.type === "freekick"
    ? ((item.payload as { dangerous?: boolean }).dangerous
        ? "text-[#FF4E00] bg-[#FF4E00]/12"
        : "text-slate-300 bg-white/8")
    : momentTone(item.type);
  return {
    icon: ph.icon, label: ph.label, tone,
    body: (
      <>
        {ph.subject ? <b className="text-white font-bold">{ph.subject}</b> : null}
        {ph.subject ? " " : null}{ph.predicate}
        {ph.context ? <span className="text-[#A2A7AF]"> · {ph.context}</span> : null}
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
      className="flex-shrink-0 w-[170px] bg-[#151B2E] border border-white/5 rounded-2xl px-3 py-2.5 text-left transition hover:border-white/15 active:scale-[0.98]"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? "bg-red-500 animate-pulse" : "bg-[#A2A7AF]"}`} />
        <span className="text-[8.8px] font-mono font-bold uppercase tracking-widest text-[#A2A7AF] whitespace-nowrap flex-shrink-0">
          {isLive ? "Live" : "Kicks off"}
        </span>
        <span className="ml-auto text-[8.5px] font-mono text-[#A2A7AF] tabular-nums whitespace-nowrap flex-shrink-0">
          {/* live → minute · today → kickoff time · days away → the date */}
          {isLive
            ? liveMinuteLabel(fixture, now)
            : isTodayFixture(fixture)
            ? kickoffLabel(fixture)
            : kickoffDay(fixture)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <CountryFlag name={fixture.teamA.name} className="w-4 h-3 flex-shrink-0" />
          <span className="text-[11px] font-black tracking-tight whitespace-nowrap flex-shrink-0 pr-0.5">{fixture.teamA.code}</span>
        </span>
        <span className="text-[13px] font-mono font-bold tabular-nums text-white flex-shrink-0 px-0.5 whitespace-nowrap">
          {isLive ? `${fixture.scoreA ?? 0}–${fixture.scoreB ?? 0}` : "vs"}
        </span>
        <span className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          <span className="text-[11px] font-black tracking-tight whitespace-nowrap flex-shrink-0 pl-0.5">{fixture.teamB.code}</span>
          <CountryFlag name={fixture.teamB.name} className="w-4 h-3 flex-shrink-0" />
        </span>
      </div>
    </button>
  );
}

// ─── global reactions on a feed moment ──────────────────────────────────────
function FeedReactions({ item }: { item: FeedItem }) {
  const { reactToFeed } = useAppState();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const t = setTimeout(() => window.addEventListener("click", close, { once: true }), 0);
    return () => { clearTimeout(t); window.removeEventListener("click", close); };
  }, [open]);
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {item.reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => reactToFeed(item, r.emoji)}
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition cursor-pointer ${
            r.mine ? "border-[#FF4E00]/45 bg-[#FF4E00]/12" : "border-white/8 bg-[#0A0E1A] hover:border-white/20"
          }`}
        >
          <span className="leading-none">{r.emoji}</span>
          <span className="font-mono font-bold text-[#A2A7AF]">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-5 h-5 grid place-items-center rounded-full bg-[#0A0E1A] border border-white/8 text-[#A2A7AF] hover:text-white transition cursor-pointer"
          aria-label="React"
        >
          <Plus className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute z-30 bottom-full left-0 mb-1 flex items-center gap-0.5 bg-[#151B2E] border border-white/10 rounded-xl px-1 py-0.5 shadow-xl">
            {SQUAD_REACTIONS.map((e) => (
              <button key={e} onClick={() => { reactToFeed(item, e); setOpen(false); }} className="text-[15px] px-1 rounded hover:bg-white/5 cursor-pointer">{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
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
      <div className="w-9 h-9 rounded-xl flex-shrink-0 grid place-items-center bg-[#0A0E1A] border border-white/5">
        <EventIcon type={item.type} payload={item.payload} size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[8.8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.tone}`}>
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap flex-shrink-0">
            <CountryFlag name={m.teamA.name} className="w-3.5 h-2.5" />
            <span className="whitespace-nowrap">{m.teamA.code} {m.scoreA ?? 0}–{m.scoreB ?? 0} {m.teamB.code}</span>
            <CountryFlag name={m.teamB.name} className="w-3.5 h-2.5" />
          </span>
          <span className="ml-auto text-[9px] font-mono text-[#A2A7AF] tabular-nums">
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
                <span className={leadA ? "text-[#FF4E00]" : "text-[#A2A7AF]"}>{m.teamA.code} {pa}%</span>
                <span className={!leadA ? "text-[#FF4E00]" : "text-[#A2A7AF]"}>{pb}% {m.teamB.code}</span>
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
        <FeedReactions item={item} />
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
  const ph = momentPhrase(item.type, item.payload, m.teamA.name, item.eventKey);
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
      <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-[#A2A7AF] whitespace-nowrap">
        <EventIcon type={item.type} payload={item.payload} size={12} strokeWidth={2.5} />
        {ph.label}
        <span className="text-slate-400">· {context}</span>
        {result && <span className="text-[#FF4E00]">· {result}</span>}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ─── full-time result card (who advances / who won) ─────────────────────────

function ResultCard({ item }: { item: FeedItem }) {
  const m = item.match;
  // Editorial one-liner ("Argentina snatch it — a 90' winner sends them past
  // England, 2–1"), derived from the result; falls back to the plain verdict.
  const summary = matchSummary(m, (item.payload as { lastGoalMin?: number }).lastGoalMin);
  const w = m.winner === "A" ? m.teamA : m.winner === "B" ? m.teamB : null;
  const method = m.period === "PENS" ? " on penalties" : m.period === "AET" ? " after extra time" : "";
  const verdict = summary
    ?? (!w
      ? "Full-time"
      : m.round === "Final"
        ? `${w.name} are champions 🏆`
        : m.round === "Third Place"
          ? `${w.name} take third place`
          : `${w.name} are through${method}`);
  return (
    <div className="flex gap-3 items-center bg-[#FF4E00]/[0.05] border border-[#FF4E00]/30 rounded-2xl p-3.5">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-[17px] bg-[#0A0E1A] border border-[#FF4E00]/20 flex-shrink-0">🏁</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8.8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[#FF4E00] bg-[#FF4E00]/15">Full-time</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap">
            <CountryFlag name={m.teamA.name} className="w-3.5 h-2.5" />
            <span className="whitespace-nowrap">{m.teamA.code} {m.scoreA ?? 0}–{m.scoreB ?? 0} {m.teamB.code}</span>
            <CountryFlag name={m.teamB.name} className="w-3.5 h-2.5" />
          </span>
        </div>
        <div className="text-[13px] font-black text-white mt-1 leading-snug">{verdict}</div>
        <FeedReactions item={item} />
      </div>
    </div>
  );
}

// ─── half-time checkpoint card ───────────────────────────────────────────────
// A neutral score-at-the-break card ("First half ends, 2–1"). Its sibling
// "second half begins" beat renders as a StateBeat divider just above it.
function HalfTimeCard({ item }: { item: FeedItem }) {
  const m = item.match;
  const a = m.scoreA ?? 0, b = m.scoreB ?? 0;
  const line =
    a === 0 && b === 0 ? "First half ends goalless."
    : a === b ? `First half ends level, ${a}–${b}.`
    : `First half ends — ${(a > b ? m.teamA : m.teamB).name} lead ${Math.max(a, b)}–${Math.min(a, b)}.`;
  return (
    <div className="flex gap-3 items-center bg-[#151B2E] border border-white/10 rounded-2xl p-3.5">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-[16px] bg-[#0A0E1A] border border-white/10 flex-shrink-0">⏸️</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8.8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-slate-300 bg-white/10">Half-time</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap">
            <CountryFlag name={m.teamA.name} className="w-3.5 h-2.5" />
            <span className="whitespace-nowrap">{m.teamA.code} {a}–{b} {m.teamB.code}</span>
            <CountryFlag name={m.teamB.name} className="w-3.5 h-2.5" />
          </span>
        </div>
        <div className="text-[12.5px] font-bold text-slate-200 mt-1 leading-snug">{line}</div>
      </div>
    </div>
  );
}

// ─── match separator ─────────────────────────────────────────────────────────
// Sits above a lineup card (a match's opening beat, at the bottom of its block)
// to visually break one match off from the next — like the kickoff divider, but
// naming the fixture so it's clear a new match's story starts here.
function MatchDivider({ m }: { m: FeedItem["match"] }) {
  return (
    <div className="flex items-center gap-2.5 pt-3 pb-1">
      <div className="flex-1 h-px bg-white/10" />
      <span className="flex items-center gap-1.5 text-[9px] font-mono font-black uppercase tracking-widest text-slate-300 whitespace-nowrap">
        <CountryFlag name={m.teamA.name} className="w-3.5 h-2.5" />
        {m.teamA.code} <span className="text-[#A2A7AF] font-bold">vs</span> {m.teamB.code}
        <CountryFlag name={m.teamB.name} className="w-3.5 h-2.5" />
        <span className="text-[#A2A7AF]">· Line-ups</span>
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ─── your result beat ("did I win it") ──────────────────────────────────────
// Personal payoff, injected just above full-time for a finished match the viewer
// had a pick on. Green when the streak survives, muted red when it broke.
function MyPickCard({ item }: { item: FeedItem }) {
  const m = item.match;
  const p = item.payload as { pick?: "A" | "B"; correct?: boolean };
  const picked = p.pick === "B" ? m.teamB : m.teamA;
  const correct = p.correct === true;
  const dest = m.round === "Final" ? "champions" : m.round === "Third Place" ? "take third" : "through";
  return (
    <div
      className={`flex gap-3 items-center rounded-2xl p-3.5 border ${
        correct ? "bg-[#22c55e]/[0.06] border-[#22c55e]/30" : "bg-[#F04438]/[0.05] border-[#F04438]/25"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl grid place-items-center text-[16px] font-black flex-shrink-0 bg-[#0A0E1A] border ${
          correct ? "border-[#22c55e]/25 text-[#22c55e]" : "border-[#F04438]/25 text-[#F04438]"
        }`}
      >
        {correct ? "✓" : "✗"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[8.8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              correct ? "text-[#22c55e] bg-[#22c55e]/15" : "text-[#F04438] bg-[#F04438]/15"
            }`}
          >
            Your pick
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap">
            <CountryFlag name={picked.name} className="w-3.5 h-2.5" />
            <span className="whitespace-nowrap pr-0.5">{picked.code}</span>
          </span>
        </div>
        <div className="text-[13px] font-black text-white mt-1 leading-snug">
          {correct ? (
            <>You called it — <span className="text-[#22c55e]">{picked.name} {dest}</span>. Streak safe.</>
          ) : (
            <>Not this time — you had {picked.name}. Streak reset.</>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── the Hub ─────────────────────────────────────────────────────────────────

const FEED_FILTERS: { id: string; label: string; types: string[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "goals", label: "Goals", types: ["goal", "penalty", "penalty_missed"] },
  { id: "cards", label: "Cards", types: ["yellow", "red"] },
  { id: "subs", label: "Subs", types: ["sub"] },
  { id: "momentum", label: "Momentum", types: ["momentum"] },
];

export default function LiveFeed({ fixtures, feed, onOpenMatch, onShareMoment }: LiveFeedProps) {
  const now = useNow();
  const [lineupItem, setLineupItem] = useState<FeedItem | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const activeFilter = FEED_FILTERS.find((f) => f.id === filter) ?? FEED_FILTERS[0];
  const shownFeed = activeFilter.types ? feed.filter((i) => activeFilter.types!.includes(i.type)) : feed;

  const live = fixtures.filter((f) => f.status === "live");
  const byKickoff = (a: Fixture, b: Fixture) =>
    (a.kickoffAt ? Date.parse(a.kickoffAt) : 0) - (b.kickoffAt ? Date.parse(b.kickoffAt) : 0);
  const upcomingAll = fixtures.filter((f) => f.status === "upcoming").sort(byKickoff);
  // Today's still-to-kick-off matches — shown with their kickoff time.
  const upcomingToday = upcomingAll.filter(isTodayFixture);
  // The soonest match on a FUTURE day (e.g. the Final) — always shown alongside
  // today's so "what's next" is visible, carrying its DATE until its day arrives.
  const nextFuture = upcomingAll.find((f) => !isTodayFixture(f));
  // Soonest upcoming on any day — feed-body empty-state text.
  const nextUp = upcomingAll[0];
  // The banner is ALWAYS on: live + today's matches + the next future match. Each
  // card adapts — LIVE, else the kickoff TIME (today) or the DATE (days away).
  const banner = [...live, ...upcomingToday, ...(nextFuture ? [nextFuture] : [])];

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-10">
      {/* Header + strip pinned together as ONE solid sticky block, so the strip
          never partially scrolls under the header (which left an empty card edge
          peeking out). */}
      <div className="sticky top-0 z-30 bg-[#0A0E1A]">
        <div className="border-b border-white/5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            {/* Same Tv icon the bottom nav uses for Hub, in the orange box Squads/Inbox use. */}
            <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-1.5 rounded-lg text-[#FF4E00]">
              <Tv className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black italic tracking-tighter uppercase text-white">Hub</h2>
          </div>
          {live.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[8.5px] font-mono font-bold uppercase tracking-widest text-[#A2A7AF]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {live.length} Live
            </span>
          )}
          <span className="ml-auto text-[8.8px] font-mono uppercase tracking-widest text-[#A2A7AF]">
            Powered by <span className="text-[#FF4E00] font-bold">TxLINE</span>
          </span>
        </div>
      </div>

        {/* Live strip — inside the sticky block, pinned with the header. Always
            present so the banner never collapses into the feed; shows a graceful
            state when there's nothing on today. */}
        {banner.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 no-scrollbar">
            {banner.map((f) => (
              <StripCard key={f.id} fixture={f} now={now} onOpen={() => onOpenMatch(f.id)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A2A7AF] flex-shrink-0" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#A2A7AF]">No matches scheduled</span>
          </div>
        )}
      </div>

      {/* Moment feed */}
      <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
        {feed.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {/* Filter the feed by moment type */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {FEED_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-shrink-0 text-[9.5px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition cursor-pointer ${
                    filter === f.id ? "bg-[#FF4E00] text-white" : "bg-[#151B2E] border border-white/5 text-[#A2A7AF] hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {shownFeed.length === 0 ? (
              <div className="text-center text-[10px] font-mono text-[#A2A7AF] uppercase tracking-wider py-10">
                No {activeFilter.label.toLowerCase()} in the feed yet.
              </div>
            ) : (
            <AnimatePresence initial={false}>
              {shownFeed.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {item.type === "mypick" ? (
                    <MyPickCard item={item} />
                  ) : item.type === "status" && (item.payload as { kind?: string }).kind === "ft" ? (
                    <ResultCard item={item} />
                  ) : item.type === "status" && (item.payload as { kind?: string }).kind === "ht" ? (
                    <HalfTimeCard item={item} />
                  ) : item.type === "status" || item.type === "stoppage" ? (
                    <StateBeat item={item} />
                  ) : item.type === "lineup" ? (
                    <>
                      <MomentCard item={item} onOpen={() => setLineupItem(item)} />
                      <MatchDivider m={item.match} />
                    </>
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
            )}
          </div>
        ) : (
          <div className="mt-10 text-center px-6">
            <div className="text-3xl mb-3">📡</div>
            <p className="text-sm font-black text-slate-200">The feed lights up at kickoff</p>
            <p className="text-xs text-[#A2A7AF] mt-1.5 leading-relaxed">
              Every goal, card, sub and VAR call lands here live — straight from TxLINE.
              {nextUp && (
                <> Next up: <span className="text-slate-300 font-bold">{nextUp.teamA.code} v {nextUp.teamB.code}</span>, {kickoffWhen(nextUp)}.</>
              )}
            </p>
          </div>
        )}
      </div>

      {lineupItem && <LineupModal item={lineupItem} onClose={() => setLineupItem(null)} />}
    </div>
  );
}
