import React from "react";
import { Fixture } from "../types";
import { Tv, Clock, ChevronLeft } from "lucide-react";
import { groupByDay, kickoffLabel } from "@/lib/match-groups";
import { useNow, liveMinuteLabel } from "@/lib/live-clock";
import CountryFlag from "./CountryFlag";
import PickConsensus from "./PickConsensus";

interface ScreenLiveScoresProps {
  fixtures: Fixture[];
  onOpenMatch: (fixtureId: string) => void;
  // "Past matches" mode: finished-only browser reached from Play. Hides the
  // live/upcoming sections and shows a titled header with a back control.
  onlyFinished?: boolean;
  title?: string;
  onBack?: () => void;
}

export default function ScreenLiveScores({ fixtures, onOpenMatch, onlyFinished, title, onBack }: ScreenLiveScoresProps) {
  const now = useNow(); // ticks live-match minutes forward between syncs
  // Group fixtures. Upcoming stays soonest-first; completed shows most-recent
  // first (down to the least recent of the round), like a results feed.
  const liveMatches = fixtures.filter((f) => f.status === "live");
  const upcomingMatches = fixtures.filter((f) => f.status === "upcoming");
  const finishedMatches = fixtures
    .filter((f) => f.status === "finished")
    .sort((a, b) => {
      const ta = a.kickoffAt ? Date.parse(a.kickoffAt) : 0;
      const tb = b.kickoffAt ? Date.parse(b.kickoffAt) : 0;
      return tb - ta; // most recent first
    });

  const renderStampBadge = (match: Fixture) => {
    if (!match.userPick) return null;

    const isA = match.userPick === "A";
    const pickedTeamName = isA ? match.teamA.name : match.teamB.name;
    const pickedCode = isA ? match.teamA.code : match.teamB.code;

    let stampColor = "bg-amber-500/10 text-amber-400 border-amber-500/20"; // Pending
    let label = `PENDING: ${pickedCode}`;

    if (match.status === "live") {
      const isWinning = isA ? (match.scoreA || 0) > (match.scoreB || 0) : (match.scoreB || 0) > (match.scoreA || 0);
      const isDrawing = match.scoreA === match.scoreB;
      if (isDrawing) {
        stampColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
        label = `DRAWING: ${pickedCode}`;
      } else if (isWinning) {
        stampColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        label = `WINNING: ${pickedCode} ✓`;
      } else {
        stampColor = "bg-red-500/10 text-red-400 border-red-500/20";
        label = `LOSING: ${pickedCode} ✗`;
      }
    } else if (match.status === "finished") {
      const won = match.userPick === match.actualWinner;
      if (won) {
        stampColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black";
        label = `WON: ${pickedCode} ★`;
      } else {
        stampColor = "bg-red-500/15 text-red-400 border-red-500/30 line-through opacity-80";
        label = `LOST: ${pickedCode} ✗`;
      }
    }

    return (
      <div
        className={`absolute top-2 right-2 rotate-6 text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border-2 ${stampColor} shadow z-25`}
        style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace" }}
      >
        ★ CALL: {label}
      </div>
    );
  };

  const renderMatchCard = (match: Fixture) => {
    const isLive = match.status === "live";
    const isFinished = match.status === "finished";

    // Setup TV broadcast score styling
    let cardBg = "bg-[#151B2E] border-white/5";
    let scoreColor = "text-white";
    let edgeAccent = "";

    if (isLive) {
      cardBg = "bg-[#151B2E] border-red-500/30 ring-1 ring-red-500/20";
      scoreColor = "text-red-500 font-mono font-black tracking-widest";
      edgeAccent = "absolute left-0 top-0 bottom-0 w-1.5 bg-red-600";
    } else if (isFinished) {
      cardBg = "bg-[#151B2E] border-white/5 opacity-70";
      scoreColor = "text-[#8E9299]";
    } else {
      cardBg = "bg-[#151B2E] border-white/5 hover:border-white/10";
    }

    return (
      <div
        key={match.id}
        onClick={() => onOpenMatch(match.id)}
        className={`relative ${cardBg} border rounded-3xl p-4 overflow-hidden shadow-lg flex flex-col justify-between transition-all cursor-pointer hover:border-white/20 active:scale-[0.99]`}
        id={`live-score-card-${match.id}`}
      >
        {edgeAccent && <div className={edgeAccent} />}
        {renderStampBadge(match)}

        {/* Top meta */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1 text-[8px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-md animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE • {liveMinuteLabel(match, now)}
              </span>
            ) : isFinished ? (
              <span className="text-[8px] font-mono text-[#8E9299] font-bold uppercase bg-[#0A0E1A] px-2 py-0.5 rounded border border-white/5">
                FINAL RESULT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[8px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                <Clock className="w-2.5 h-2.5" /> UPCOMING
              </span>
            )}
            <span className="text-[9px] font-mono text-[#8E9299] font-bold uppercase tracking-wider">
              {match.round}
            </span>
          </div>
        </div>

        {/* Central scoreboard row */}
        <div className="flex justify-between items-center py-3 px-1">
          {/* Team A */}
          <div className="flex flex-col items-center text-center w-[38%] min-w-0">
            <CountryFlag name={match.teamA.name} className="w-9 h-6 mb-1.5" />
            <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight leading-tight text-center">
              {match.teamA.name}
            </span>
            <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">
              {match.teamA.code}
            </span>
          </div>

          {/* Scores (TV Scorebug display) */}
          <div className="flex flex-col items-center justify-center px-2">
            <div className="bg-[#0A0E1A] border border-white/5 px-3 py-1.5 rounded-full flex items-center justify-center shadow-inner">
              {isFinished || isLive ? (
                <span className={`text-base sm:text-lg font-mono font-black ${scoreColor} tracking-wider whitespace-nowrap`}>
                  {match.scoreA} - {match.scoreB}
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold text-[#8E9299] whitespace-nowrap px-1">
                  {kickoffLabel(match)}
                </span>
              )}
            </div>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center text-center w-[38%] min-w-0">
            <CountryFlag name={match.teamB.name} className="w-9 h-6 mb-1.5" />
            <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight leading-tight text-center">
              {match.teamB.name}
            </span>
            <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">
              {match.teamB.code}
            </span>
          </div>
        </div>

        {/* Fan pick-consensus — how the app is calling it (not on finished cards) */}
        {!isFinished && (
          <div className="px-1 pb-1">
            <PickConsensus teamA={match.teamA} teamB={match.teamB} counts={match.pickCounts} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-10">
      {/* Visual Header */}
      <div className="sticky top-0 bg-[#0A0E1A]/85 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Back"
              className="bg-[#151B2E] border border-white/5 p-1.5 rounded-lg text-slate-300 hover:text-white hover:border-white/15 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-1.5 rounded-lg text-[#FF4E00]">
              <Tv className="w-4 h-4" />
            </div>
          )}
          <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">
            {title ?? "Score Hub"}
          </h2>
        </div>
        <span className="text-[10px] font-mono text-[#8E9299] font-bold uppercase tracking-widest bg-[#151B2E] px-2.5 py-1 rounded-lg border border-white/5">
          World Cup 2026
        </span>
      </div>

      <div className="px-4 space-y-6 mt-4 max-w-7xl mx-auto w-full">
        {/* 1. Live Now Match List */}
        {!onlyFinished && liveMatches.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-wider pl-1 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
              Live In Play
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map(renderMatchCard)}
            </div>
          </div>
        )}

        {/* 2. Upcoming — grouped by day (Today / Tomorrow / dates) */}
        {!onlyFinished && upcomingMatches.length > 0 && (
          <div className="space-y-5">
            <h3 className="text-[10px] font-mono font-bold text-[#FF4E00] uppercase tracking-wider pl-1">
              {upcomingMatches[0]?.round ?? "Knockout"} Upcoming Fixtures
            </h3>
            {groupByDay(upcomingMatches).map((grp) => (
              <div key={grp.key} className="space-y-3">
                <h4 className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest pl-1 flex items-center gap-2">
                  {grp.label}
                  <span className="text-[#8E9299] font-normal">· {grp.fixtures.length}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grp.fixtures.map(renderMatchCard)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. Completed matches */}
        {finishedMatches.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono font-bold text-[#8E9299] uppercase tracking-wider pl-1">
              {onlyFinished ? "Every match played" : "Completed Matches"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finishedMatches.map(renderMatchCard)}
            </div>
          </div>
        )}

        {/* Empty state — only relevant in the finished-only browser. */}
        {onlyFinished && finishedMatches.length === 0 && (
          <div className="mt-16 text-center px-6">
            <div className="text-3xl mb-3">🗂</div>
            <p className="text-sm font-black italic text-slate-200">No matches played yet</p>
            <p className="text-xs text-[#8E9299] mt-1.5">Finished matches show up here as the tournament unfolds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
