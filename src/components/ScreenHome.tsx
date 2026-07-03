import React, { useState, useEffect } from "react";
import { Fixture, AvatarConfig, Team } from "../types";
import type { GlobalLeaderboardEntry, RoundRace } from "@/lib/api/client";
import { fetchRoundRace } from "@/lib/api/client";
import { groupByDay, kickoffLabel } from "@/lib/match-groups";
import { useNow, liveMinuteLabel } from "@/lib/live-clock";
import AvatarRenderer from "./AvatarRenderer";
import CountryFlag from "./CountryFlag";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Zap, Award, ChevronRight, X, Sparkles, Trophy, CheckCircle2, Globe, Search, Maximize2, Crown } from "lucide-react";

interface GlobalLeader {
  id: string;
  username: string;
  flag?: string; // optional — real users have no nationality field yet
  streak: number;
  points: number;
  rank?: number;
  avatar: AvatarConfig;
  isCurrentUser?: boolean;
}

const getLevelInfo = (pts: number) => {
  const basePts = Math.max(150, pts);
  const lvl = Math.max(1, Math.floor((basePts - 150) / 100) + 1);
  const getTitle = (l: number) => {
    if (l >= 10) return "Mythic";
    if (l >= 8) return "Legend";
    if (l >= 6) return "Elite";
    if (l >= 4) return "Pro";
    if (l >= 2) return "Contender";
    return "Rookie";
  };
  return { level: lvl, title: getTitle(lvl) };
};

interface ScreenHomeProps {
  avatar: AvatarConfig;
  streak: number;
  personalBest: number;
  points: number;
  fixtures: Fixture[];
  globalLeaderboard: GlobalLeaderboardEntry[];
  walletAddress?: string;
  onMakePick: (fixtureId: string, pick: "A" | "B") => void;
  onOpenProfile: () => void;
}

// Knockout rounds in tournament order — drives the Knockout Stage tracker.
const KO_ROUNDS = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Final"] as const;
const KO_SHORT: Record<string, string> = {
  "Round of 32": "R32", "Round of 16": "R16", "Quarterfinals": "QF",
  "Semifinals": "SF", "Final": "F",
};
// Only these rounds crown a Round Champion (SF/Final too few matches).
const CHAMPION_ROUNDS = new Set(["Round of 32", "Round of 16", "Quarterfinals"]);

type RoundStatus = "done" | "live" | "upcoming";

function roundStatus(fixtures: Fixture[], round: string): { status: RoundStatus; total: number; done: number } {
  const inRound = fixtures.filter((f) => f.round === round);
  const total = inRound.length;
  const done = inRound.filter((f) => f.status === "finished").length;
  const anyLive = inRound.some((f) => f.status === "live");
  let status: RoundStatus = "upcoming";
  if (total > 0 && done === total) status = "done";
  else if (anyLive || (done > 0 && done < total)) status = "live";
  return { status, total, done };
}

export default function ScreenHome({
  avatar,
  streak,
  personalBest,
  points,
  fixtures,
  globalLeaderboard,
  walletAddress,
  onMakePick,
  onOpenProfile,
}: ScreenHomeProps) {
  const now = useNow(); // ticks live-match minutes forward between syncs

  // Result cards the user has dismissed (X) — declutter Play after a pick
  // resolves. Persisted so they stay gone across refreshes.
  const [dismissedResults, setDismissedResults] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = localStorage.getItem("streakr_dismissed_results");
      if (saved) setDismissedResults(new Set(JSON.parse(saved) as string[]));
    } catch { /* ignore */ }
  }, []);
  const dismissResult = (id: string) => {
    setDismissedResults((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem("streakr_dismissed_results", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // Local state for selected match to predict (Pick Flow)
  const [activePickFixture, setActivePickFixture] = useState<Fixture | null>(null);
  const [successAnimationMatchId, setSuccessAnimationMatchId] = useState<string | null>(null);

  // Global Leaderboard sorting and searching states
  const [globalSortBy, setGlobalSortBy] = useState<"streak" | "points">("streak");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGlobalLeaderboardModal, setShowGlobalLeaderboardModal] = useState(false);

  // Knockout Stage tracker — derive each round's status from live fixtures.
  const koStages = KO_ROUNDS.map((round) => ({ round, ...roundStatus(fixtures, round) }));
  // "Current" round = first that isn't finished (else the last round).
  const currentStage = koStages.find((s) => s.status !== "done") ?? koStages[koStages.length - 1];

  // Round Champion race modal (opens on the selected knockout round).
  const [raceRound, setRaceRound] = useState<string | null>(null);
  const [raceData, setRaceData] = useState<RoundRace | null>(null);
  const [raceLoading, setRaceLoading] = useState(false);

  useEffect(() => {
    if (!raceRound) return;
    let cancelled = false;
    setRaceLoading(true);
    setRaceData(null);
    fetchRoundRace(raceRound, walletAddress)
      .then((r) => { if (!cancelled) setRaceData(r); })
      .catch(() => { if (!cancelled) setRaceData(null); })
      .finally(() => { if (!cancelled) setRaceLoading(false); });
    return () => { cancelled = true; };
  }, [raceRound, walletAddress]);

  const getGlobalStandings = () => {
    // Real global board (already includes the current user). Override the
    // current user's row with their live streak/points/mascot, and add them if
    // the board hasn't picked them up yet (e.g. brand-new account).
    const combined: GlobalLeader[] = globalLeaderboard.map((m) =>
      m.isCurrentUser
        ? { id: m.id, username: avatar.username, flag: avatar.nation, streak, points, avatar, isCurrentUser: true }
        : { id: m.id, username: m.username, flag: m.avatar?.nation, streak: m.streak, points: m.points, avatar: m.avatar }
    );
    if (!combined.some((m) => m.isCurrentUser)) {
      combined.push({ id: "currentUser", username: avatar.username, flag: avatar.nation, streak, points, avatar, isCurrentUser: true });
    }

    if (globalSortBy === "streak") {
      combined.sort((a, b) => {
        if (b.streak !== a.streak) return b.streak - a.streak;
        return b.points - a.points;
      });
    } else {
      combined.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.streak - a.streak;
      });
    }

    const ranked = combined.map((m, idx) => ({ ...m, rank: idx + 1 }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return ranked.filter(m => m.username.toLowerCase().includes(q));
    }
    return ranked;
  };

  // Filter fixtures
  const liveMatches = fixtures.filter((f) => f.status === "live");
  const upcomingMatches = fixtures.filter((f) => f.status === "upcoming");
  // The user's own resolved picks — surfaced right in Play so you don't have to
  // dig into the Hub to learn whether you won or lost. Most recent first.
  const myResults = fixtures
    .filter((f) => f.userPick && f.status === "finished" && f.actualWinner && !dismissedResults.has(f.id))
    .sort((a, b) => (b.kickoffAt ? Date.parse(b.kickoffAt) : 0) - (a.kickoffAt ? Date.parse(a.kickoffAt) : 0))
    .slice(0, 6);

  const handlePickSubmit = (fixtureId: string, pick: "A" | "B") => {
    onMakePick(fixtureId, pick);
    setActivePickFixture(null);

    // Trigger instant correct-call success visual confirmation
    setSuccessAnimationMatchId(fixtureId);
    setTimeout(() => {
      setSuccessAnimationMatchId(null);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-6 relative">
      {/* Background neon flares */}
      <div className="absolute top-10 left-1/4 w-40 h-40 bg-[#FF4E00]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-80 right-1/4 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Persistent Game HUD Header */}
      <div className="sticky top-0 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/5 px-4 py-3.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {/* Avatar Thumbnail */}
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-xl bg-[#2D364F]/50 hover:bg-[#2D364F] border border-white/5 flex items-center justify-center p-0.5 shadow relative group transition"
            id="home-profile-thumbnail"
          >
            <AvatarRenderer
              skinTone={avatar.skinTone}
              kitPrimary={avatar.kitPrimary}
              kitSecondary={avatar.kitSecondary}
              expression={avatar.expression}
              size="sm"
              isAnimated={false}
              upperBodyOnly={true}
            />
            {/* Tiny edit badge */}
            <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-[#FF4E00] rounded-full border-2 border-[#0A0E1A] text-[8px] font-bold flex items-center justify-center text-white scale-90">
              ⚡
            </span>
          </button>

          {/* Username greeting */}
          <div>
            <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block leading-none">
              Welcome back
            </span>
            <span className="text-xs font-black italic text-slate-200">
              @{avatar.username || "Fan_402"}
            </span>
          </div>
        </div>

        {/* Global Stats Dashboard Pill (Duolingo style) */}
        <div className="flex items-center gap-1.5 bg-[#151B2E] border border-white/5 p-1 rounded-2xl shadow-inner">
          {/* Streak Counter Flame */}
          <motion.div
            animate={streak > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 10 }}
            className="flex items-center gap-1.5 bg-[#FF4E00]/10 text-[#FF4E00] border border-[#FF4E00]/10 px-2.5 py-1 rounded-xl"
            id="hud-streak-flame"
          >
            <Flame className={`w-4 h-4 fill-current ${streak > 0 ? "text-[#FF4E00] animate-pulse" : "text-[#8E9299]"}`} />
            <span className="text-xs font-black font-mono leading-none">{streak}</span>
          </motion.div>

          {/* Points Crystal */}
          <div id="hud-points" className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 px-2.5 py-1 rounded-xl">
            <Award className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black font-mono leading-none">{points}P</span>
          </div>
        </div>
      </div>

      {/* Main Home Scroll Area */}
      <div className="px-4 mt-4 flex-grow max-w-7xl mx-auto w-full z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Matches Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* 0. Your latest results — proactive win/loss surfacing */}
            {myResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-mono font-black text-[#8E9299] uppercase tracking-widest pl-1.5">
                  Your Latest Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myResults.map((m) => {
                    const correct = m.userPick === m.actualWinner;
                    const pickTeam = m.userPick === "A" ? m.teamA : m.teamB;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between gap-2 p-3 rounded-2xl border ${
                          correct ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/25"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <CountryFlag name={pickTeam.name} className="w-6 h-4 flex-shrink-0" width={40} />
                          <div className="min-w-0">
                            <span className="text-xs font-black italic text-white truncate block">{pickTeam.name}</span>
                            <span className="text-[9px] font-mono text-[#8E9299]">
                              {m.teamA.code} {m.scoreA}–{m.scoreB} {m.teamB.code}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-black italic px-2.5 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 ${
                            correct ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          {correct ? "Correct" : "Missed"}
                        </span>
                        <button
                          onClick={() => dismissResult(m.id)}
                          aria-label="Dismiss result"
                          className="flex-shrink-0 p-1 -mr-1 text-[#8E9299] hover:text-white transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1. Live Now Section */}
            {liveMatches.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-mono font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5 pl-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                  Matches Live Now
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveMatches.map((match) => {
                    const hasPicked = !!match.userPick;
                    const pickName = match.userPick === "A" ? match.teamA.name : match.teamB.name;
                    
                    return (
                      <div
                        key={match.id}
                        className="bg-[#151B2E] border border-red-500/25 rounded-3xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between"
                      >
                        {/* Subtle live background glow */}
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-red-500/5 rounded-l-full filter blur-xl pointer-events-none" />

                        <div>
                          {/* Header */}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-mono text-red-400 font-bold tracking-wider uppercase bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                              Match Live • {liveMinuteLabel(match, now)}
                            </span>
                            <span className="text-[9px] font-mono text-[#8E9299] font-bold uppercase">
                              {match.round}
                            </span>
                          </div>

                          {/* Teams / Score Grid */}
                          <div className="flex justify-between items-center py-2 px-1">
                            {/* Team A */}
                            <div className="flex flex-col items-center text-center w-[38%] min-w-0">
                              <CountryFlag name={match.teamA.name} className="w-9 h-6 mb-1.5" />
                              <span className="text-[10px] xs:text-xs sm:text-sm font-black text-white whitespace-nowrap uppercase tracking-tight">{match.teamA.name}</span>
                              <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">{match.teamA.code}</span>
                            </div>

                            {/* Score Display */}
                            <div className="flex flex-col items-center justify-center px-2">
                              <div className="bg-[#0A0E1A] border border-white/5 px-3 py-1.5 rounded-full flex items-center justify-center shadow-inner">
                                <span className="text-base sm:text-lg font-mono font-black text-[#FF4E00] tracking-wider whitespace-nowrap">
                                  {match.scoreA} - {match.scoreB}
                                </span>
                              </div>
                            </div>

                            {/* Team B */}
                            <div className="flex flex-col items-center text-center w-[38%] min-w-0">
                              <CountryFlag name={match.teamB.name} className="w-9 h-6 mb-1.5" />
                              <span className="text-[10px] xs:text-xs sm:text-sm font-black text-white whitespace-nowrap uppercase tracking-tight">{match.teamB.name}</span>
                              <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">{match.teamB.code}</span>
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Prediction feedback */}
                        <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between">
                          {hasPicked ? (
                            <div className="flex items-center gap-2 bg-[#0A0E1A] border border-white/5 px-3.5 py-2.5 rounded-2xl w-full justify-between shadow-inner">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-[#8E9299] font-bold uppercase tracking-wider text-[10px]">Your Pick:</span>
                                <span className="text-xs font-black text-[#FF4E00]">
                                  {pickName}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono font-bold bg-[#FF4E00]/10 text-[#FF4E00] border border-[#FF4E00]/20 px-2 py-0.5 rounded-full">
                                Locked
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-[#0A0E1A]/45 border border-white/5 px-3.5 py-2.5 rounded-2xl w-full justify-between shadow-inner opacity-70">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#8E9299] font-bold uppercase tracking-wider text-[10px]">Your Pick:</span>
                                <span className="text-xs font-black text-slate-500 uppercase tracking-tight">
                                  No Prediction
                                </span>
                              </div>
                              <span className="text-[9px] font-mono font-bold bg-white/5 text-slate-400 border border-white/5 px-2 py-0.5 rounded-full uppercase">
                                Closed
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Upcoming — grouped by day (Today / Tomorrow / dates) */}
            <div className="space-y-5">
              <h3 className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                <Zap className="w-3.5 h-3.5 text-[#FF4E00]" />
                {upcomingMatches[0]?.round ?? "Knockout"} Bracket Picks
              </h3>
              {groupByDay(upcomingMatches).map((grp) => (
                <div key={grp.key} className="space-y-3">
                  <h4 className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest pl-1 flex items-center gap-2">
                    {grp.label}
                    <span className="text-[#8E9299] font-normal">· {grp.fixtures.length}</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {grp.fixtures.map((match) => {
                  const hasPicked = !!match.userPick;
                  const pickTeam = match.userPick === "A" ? match.teamA : match.teamB;
                  const isAnimating = successAnimationMatchId === match.id;

                  return (
                    <div
                      key={match.id}
                      className={`bg-[#151B2E] border rounded-3xl p-4 shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
                        hasPicked ? "border-white/5 opacity-95" : "border-white/5 hover:border-white/20"
                      }`}
                    >
                      {/* Confetti simulation overlay when pick completed */}
                      <AnimatePresence>
                        {isAnimating && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#FF4E00]/10 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-2 text-center"
                          >
                            <motion.div
                              initial={{ scale: 0.5, y: 10 }}
                              animate={{ scale: 1, y: 0 }}
                              className="flex flex-col items-center"
                            >
                              <Sparkles className="w-6 h-6 text-[#FF4E00] fill-[#FF4E00] animate-bounce" />
                              <span className="text-xs font-black text-white mt-1 uppercase tracking-widest">
                                PICK LOCKED! 🔥
                              </span>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        {/* Header Row */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] font-mono text-[#8E9299] font-bold uppercase tracking-wider">
                            KO Stage • {kickoffLabel(match)}
                          </span>
                          <span className="text-[9px] font-mono text-[#8E9299] font-bold uppercase">
                            {match.round}
                          </span>
                        </div>

                        {/* Teams layout row */}
                        <div className="flex justify-between items-center py-1">
                          {/* Team A */}
                          <div className="flex flex-col items-center text-center w-[40%]">
                            <CountryFlag name={match.teamA.name} className="w-9 h-6 mb-1.5" />
                            <span className="text-xs font-black text-white truncate w-full">{match.teamA.name}</span>
                            <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">{match.teamA.code}</span>
                          </div>

                          {/* VS divider */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-mono font-bold text-[#8E9299] bg-[#0A0E1A] border border-white/5 px-2.5 py-0.5 rounded-full uppercase">
                              VS
                            </span>
                          </div>

                          {/* Team B */}
                          <div className="flex flex-col items-center text-center w-[40%]">
                            <CountryFlag name={match.teamB.name} className="w-9 h-6 mb-1.5" />
                            <span className="text-xs font-black text-white truncate w-full">{match.teamB.name}</span>
                            <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase">{match.teamB.code}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tap affordance row */}
                      <div className="mt-4 pt-3.5 border-t border-white/5">
                        {hasPicked ? (
                          <div className="flex items-center justify-between bg-[#0A0E1A] border border-white/5 p-2 rounded-2xl">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CountryFlag name={pickTeam.name} className="w-5 h-3.5 flex-shrink-0" />
                              <span className="text-xs font-black text-[#FF4E00] truncate">{pickTeam.name}</span>
                            </div>
                            <button
                              onClick={() => setActivePickFixture(match)}
                              className="text-[9px] font-mono text-slate-300 hover:text-white bg-[#2D364F]/50 border border-white/5 px-2.5 py-1 rounded-lg transition flex-shrink-0 ml-1"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActivePickFixture(match)}
                            className="w-full bg-[#2D364F]/30 hover:bg-[#2D364F]/60 border border-white/5 rounded-xl py-2.5 px-3.5 text-xs font-black text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                            id={`home-tap-pick-${match.id}`}
                          >
                            <span className="flex items-center gap-2 text-slate-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              Make your pick
                            </span>
                            <ChevronRight className="w-4 h-4 text-[#8E9299]" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right Info Sidebar Column */}
          <div className="space-y-5">
            
            {/* 3. Knockout Stage tracker — The Road to the Final */}
            <button
              onClick={() => setRaceRound(currentStage.round)}
              className="w-full text-left bg-[#151B2E] border border-white/5 hover:border-[#FF4E00]/30 rounded-3xl p-5 overflow-hidden relative transition group cursor-pointer"
              id="knockout-stage-card"
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-[#FF4E00]/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-start justify-between gap-2 z-10 relative">
                <div className="space-y-1">
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[#FF4E00] block">Knockout Stage</span>
                  <h4 className="text-sm font-black italic text-white uppercase tracking-tight">The Road to the Final</h4>
                </div>
                <Trophy className="w-8 h-8 text-[#FF4E00]/80 flex-shrink-0" />
              </div>

              {/* Round stepper */}
              <div className="mt-4 flex items-center z-10 relative">
                {koStages.map((s, i) => {
                  const isCurrent = s.round === currentStage.round;
                  const dot =
                    s.status === "done" ? "bg-emerald-400 border-emerald-400"
                    : s.status === "live" ? "bg-[#FF4E00] border-[#FF4E00] shadow-[0_0_8px_rgba(255,78,0,0.7)]"
                    : "bg-transparent border-white/20";
                  const label =
                    s.status === "done" ? "text-emerald-400"
                    : s.status === "live" ? "text-[#FF4E00]"
                    : isCurrent ? "text-slate-300" : "text-[#8E9299]";
                  return (
                    <React.Fragment key={s.round}>
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full border-2 ${dot} transition`} />
                        <span className={`text-[9px] font-mono font-black uppercase tracking-wide ${label}`}>
                          {KO_SHORT[s.round]}
                        </span>
                      </div>
                      {i < koStages.length - 1 && (
                        <div className={`flex-grow h-0.5 mx-1 -mt-4 rounded-full ${koStages[i].status === "done" ? "bg-emerald-400/40" : "bg-white/10"}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Current round + CTA */}
              <div className="mt-4 flex items-center justify-between z-10 relative">
                <p className="text-[10px] text-[#8E9299] leading-relaxed">
                  {currentStage.status === "live"
                    ? <><span className="text-[#FF4E00] font-bold">{currentStage.round}</span> is live — {currentStage.done}/{currentStage.total} decided.</>
                    : currentStage.status === "done"
                      ? <>The <span className="text-white font-bold">Final</span> is done — champions crowned.</>
                      : <><span className="text-white font-bold">{currentStage.round}</span> up next.</>}
                </p>
                <span className="text-[10px] font-black italic text-[#FF4E00] flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                  {CHAMPION_ROUNDS.has(currentStage.round) ? "Champion race" : "View round"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>

            {/* Global Arena Leaderboard Widget */}
            <div id="global-leaderboard-widget" className="hidden lg:block bg-[#151B2E] border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-1.5 rounded-lg text-[#FF4E00]">
                    <Globe className="w-4 h-4 text-[#FF4E00]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black italic text-slate-200 uppercase tracking-tight">
                      Global Leaderboard
                    </h4>
                    <span className="text-[8px] font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      Live world rankings
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowGlobalLeaderboardModal(true)}
                  className="p-1.5 bg-[#0A0E1A] hover:bg-[#2D364F]/50 border border-white/5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                  title="Expand Leaderboard"
                >
                  <Maximize2 className="w-3 h-3 text-[#FF4E00]" />
                  <span>Expand</span>
                </button>
              </div>

              {/* Sorting Tabs */}
              <div className="flex gap-1.5 bg-[#0A0E1A] p-1 rounded-2xl border border-white/5">
                <button
                  onClick={() => setGlobalSortBy("streak")}
                  className={`flex-grow py-1.5 rounded-xl text-[9px] font-black italic uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 ${
                    globalSortBy === "streak"
                      ? "bg-[#FF4E00]/10 text-[#FF4E00]"
                      : "text-[#8E9299] hover:text-white"
                  }`}
                >
                  <Flame className="w-3 h-3 fill-current" /> Active Streak
                </button>
                <button
                  onClick={() => setGlobalSortBy("points")}
                  className={`flex-grow py-1.5 rounded-xl text-[9px] font-black italic uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 ${
                    globalSortBy === "points"
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "text-[#8E9299] hover:text-white"
                  }`}
                >
                  <Award className="w-3 h-3" /> Points
                </button>
              </div>

              {/* Compact Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3 h-3 text-[#8E9299]" />
                <input
                  type="text"
                  placeholder="Search by username…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0E1A] border border-white/5 focus:border-[#FF4E00]/50 rounded-xl pl-8 pr-3 py-1.5 text-[10px] text-white placeholder-slate-650 outline-none"
                />
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                {getGlobalStandings().map((member) => {
                  const isTop3 = member.rank <= 3;
                  return (
                    <div
                      key={member.id}
                      className={`p-2 rounded-2xl flex items-center justify-between border ${
                        member.isCurrentUser
                          ? "bg-[#FF4E00]/5 border-[#FF4E00]/30"
                          : "bg-[#0A0E1A]/40 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Rank */}
                        <div className="w-5 text-center flex-shrink-0">
                          {member.rank === 1 ? (
                            <span className="text-xs">🥇</span>
                          ) : member.rank === 2 ? (
                            <span className="text-xs">🥈</span>
                          ) : member.rank === 3 ? (
                            <span className="text-xs">🥉</span>
                          ) : (
                            <span className="text-[9px] font-mono font-bold text-[#8E9299]">#{member.rank}</span>
                          )}
                        </div>

                        {/* Tiny Avatar */}
                        <div className="w-6.5 h-6.5 bg-[#0A0E1A] border border-white/5 rounded-lg p-0.5 flex-shrink-0 flex items-center justify-center">
                          <AvatarRenderer
                            skinTone={member.avatar.skinTone}
                            kitPrimary={member.avatar.kitPrimary}
                            kitSecondary={member.avatar.kitSecondary}
                            expression={member.avatar.expression}
                            size="sm"
                            upperBodyOnly={true}
                          />
                        </div>

                        {/* Username — canonical flex truncation (span grows itself) */}
                        {member.flag && <CountryFlag name={member.flag} className="w-4 h-3 flex-shrink-0" width={40} />}
                        <span className="text-[11px] font-black italic text-slate-200 truncate flex-1 min-w-0 pr-1.5">
                          @{member.username}
                        </span>
                        {member.isCurrentUser && (
                          <span className="text-[7px] font-mono font-bold bg-[#FF4E00] text-white px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>

                      {/* Score — one clear metric */}
                      <div className="flex-shrink-0 text-right pl-2 whitespace-nowrap">
                        {globalSortBy === "streak" ? (
                          <span className="font-mono font-black text-xs text-[#FF4E00]">🔥 {member.streak}</span>
                        ) : (
                          <span className="font-mono font-black text-xs text-indigo-400">{member.points.toLocaleString()} <span className="text-[8px] text-[#8E9299]">PTS</span></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick user highlight if not searched — real rank + both metrics */}
              {!searchQuery && (() => {
                const myRank = getGlobalStandings().find((m) => m.isCurrentUser)?.rank;
                return (
                  <div className="bg-gradient-to-r from-[#11243A]/60 to-[#151B2E] border border-[#FF4E00]/10 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-black italic text-slate-300 whitespace-nowrap flex-shrink-0">
                      Your Rank: <span className="text-[#FF4E00]">{myRank ? `#${myRank}` : "—"}</span>
                    </span>
                    <span className="font-mono text-[#8E9299] whitespace-nowrap flex-shrink-0 flex items-center gap-2">
                      <span className="text-[#FF4E00]">🔥 {streak}</span>
                      <span>{points.toLocaleString()} PTS</span>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Premium Streak Tip Widget */}
            <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 relative overflow-hidden">
              <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-[#FF4E00]/5 rounded-full blur-xl pointer-events-none" />
              <h4 className="text-xs font-black italic text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                🔥 Pro Streak Strategy
              </h4>
              <p className="text-[10px] text-[#8E9299] leading-relaxed mt-1.5">
                Knockout stages have no draws! If a match goes to Extra Time or Penalty Shootouts, your pick tracks who eventually wins. Lock in early, and check your Group Feed to see who else has made their calls!
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Screen 6 — PICK FLOW MODAL OVERLAY */}
      <AnimatePresence>
        {activePickFixture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0A0E1A]/97 z-[60] flex flex-col p-5 sm:p-6"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-mono text-slate-300 font-bold uppercase tracking-widest bg-[#151B2E] border border-white/5 px-3 py-1.5 rounded-full">
                Make your Choice
              </span>
              <button
                onClick={() => setActivePickFixture(null)}
                className="p-2 bg-[#2D364F]/50 hover:bg-[#2D364F] border border-white/5 rounded-full text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Centered content — intro + selectors share the space between the
                header and the disclaimer, with real breathing room top/bottom. */}
            <div className="flex-grow flex flex-col justify-center gap-8 sm:gap-10 py-6 min-h-0 overflow-y-auto">
            {/* Middle Call to action instructions */}
            <div className="text-center px-4">
              <span className="inline-block bg-[#FF4E00]/10 border border-[#FF4E00]/20 text-[#FF4E00] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-2">
                🔒 Knockout Stage Rules
              </span>
              <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                WHO ADVANCES?
              </h2>
              <p className="text-xs text-[#8E9299] mt-2 max-w-sm mx-auto leading-relaxed">
                No draws. Includes extra time and penalties. Keep choosing the right teams to build your streak!
              </p>
            </div>

            {/* Massive Quiz-style Compare Selectors */}
            <div className="space-y-4 max-w-md w-full mx-auto">
              {/* Option A (Team A) */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePickSubmit(activePickFixture.id, "A")}
                className="w-full bg-[#151B2E] hover:bg-[#FF4E00]/10 border border-white/5 hover:border-[#FF4E00] p-6 rounded-3xl flex items-center justify-between group transition-all duration-300 shadow-xl text-left cursor-pointer"
                id="pick-flow-team-a"
              >
                <div className="flex items-center gap-5">
                  <CountryFlag name={activePickFixture.teamA.name} className="w-14 h-10" width={160} />
                  <div>
                    <span className="text-xl font-black text-white group-hover:text-[#FF4E00] transition-colors">
                      {activePickFixture.teamA.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#8E9299] uppercase block">
                      Code: {activePickFixture.teamA.code}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-[#FF4E00] group-hover:border-[#FF4E00] group-hover:bg-[#FF4E00]/10 font-bold transition">
                  ✓
                </div>
              </motion.button>

              {/* Option B (Team B) */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePickSubmit(activePickFixture.id, "B")}
                className="w-full bg-[#151B2E] hover:bg-[#FF4E00]/10 border border-white/5 hover:border-[#FF4E00] p-6 rounded-3xl flex items-center justify-between group transition-all duration-300 shadow-xl text-left cursor-pointer"
                id="pick-flow-team-b"
              >
                <div className="flex items-center gap-5">
                  <CountryFlag name={activePickFixture.teamB.name} className="w-14 h-10" width={160} />
                  <div>
                    <span className="text-xl font-black text-white group-hover:text-[#FF4E00] transition-colors">
                      {activePickFixture.teamB.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#8E9299] uppercase block">
                      Code: {activePickFixture.teamB.code}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-[#FF4E00] group-hover:border-[#FF4E00] group-hover:bg-[#FF4E00]/10 font-bold transition">
                  ✓
                </div>
              </motion.button>
            </div>
            </div>

            {/* Bottom Disclaimer — lifted off the very edge */}
            <div className="text-center text-[10px] text-[#8E9299] max-w-xs mx-auto flex-shrink-0 pt-2 pb-4 uppercase font-bold tracking-wide">
              Picks can be altered at any time until kickoff. Tapping either button locks the selection instantly.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Globe Circle for Mobile */}
      <div className="lg:hidden fixed bottom-24 right-5 z-40">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowGlobalLeaderboardModal(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FF4E00] to-[#FF8F00] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(255,78,0,0.5)] border-2 border-[#151B2E] cursor-pointer"
          title="Global Leaderboard"
          id="mobile-globe-button"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          >
            <Globe className="w-6.5 h-6.5 text-white" />
          </motion.div>
        </motion.button>
      </div>

      {/* GLOBAL LEADERBOARD EXPANDED OVERLAY */}
      <AnimatePresence>
        {showGlobalLeaderboardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0A0E1A]/95 backdrop-blur-md z-50 flex items-center justify-center p-0 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#151B2E] border border-white/10 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-[#1C233D] border-b border-white/5 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-2.5 rounded-2xl text-[#FF4E00] animate-pulse">
                    <Globe className="w-5 h-5 text-[#FF4E00]" />
                  </div>
                  <div>
                    <h2 className="text-base font-black italic text-white uppercase tracking-tight">
                      Global Leaderboard
                    </h2>
                    <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-wider block">
                      Live world rankings
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGlobalLeaderboardModal(false)}
                  className="p-2 bg-[#0A0E1A] hover:bg-[#FF4E00]/20 border border-white/5 hover:border-[#FF4E00]/30 rounded-full text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body / Search and Controls */}
              <div className="p-5 border-b border-white/5 space-y-4">
                {/* Tab select sorting */}
                <div className="flex gap-2 bg-[#0A0E1A] p-1 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setGlobalSortBy("streak")}
                    className={`flex-grow py-2.5 rounded-xl text-[10px] font-black italic uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                      globalSortBy === "streak"
                        ? "bg-[#FF4E00]/10 text-[#FF4E00] border border-[#FF4E00]/20"
                        : "text-[#8E9299] hover:text-white"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 fill-current" /> Active Streak
                  </button>
                  <button
                    onClick={() => setGlobalSortBy("points")}
                    className={`flex-grow py-2.5 rounded-xl text-[10px] font-black italic uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                      globalSortBy === "points"
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : "text-[#8E9299] hover:text-white"
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" /> Points
                  </button>
                </div>

                {/* Big Search Input */}
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-[#8E9299]" />
                  <input
                    type="text"
                    placeholder="Search by username…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0A0E1A] border border-white/5 focus:border-[#FF4E00]/50 rounded-2xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-550 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-3.5 text-[9px] uppercase font-mono font-bold text-[#FF4E00] hover:text-orange-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Standings List */}
              <div className="flex-grow p-5 overflow-y-auto space-y-2.5 bg-[#0C1224]">
                {getGlobalStandings().length > 0 ? (
                  getGlobalStandings().map((member) => {
                    const isTop3 = member.rank <= 3;
                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                          member.isCurrentUser
                            ? "bg-[#FF4E00]/10 border-[#FF4E00] shadow-[0_0_15px_rgba(255,78,0,0.15)]"
                            : isTop3
                            ? "bg-[#151B2E] border-white/10"
                            : "bg-[#151B2E]/50 border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Rank */}
                          <div className="w-7 text-center flex-shrink-0">
                            {member.rank === 1 ? (
                              <span className="text-xl">🥇</span>
                            ) : member.rank === 2 ? (
                              <span className="text-xl">🥈</span>
                            ) : member.rank === 3 ? (
                              <span className="text-xl">🥉</span>
                            ) : (
                              <span className="text-xs font-mono font-black text-[#8E9299]">#{member.rank}</span>
                            )}
                          </div>

                          {/* Avatar */}
                          <div className="w-9 h-9 bg-[#0A0E1A] border border-white/5 rounded-xl p-0.5 flex-shrink-0 flex items-center justify-center">
                            <AvatarRenderer
                              skinTone={member.avatar.skinTone}
                              kitPrimary={member.avatar.kitPrimary}
                              kitSecondary={member.avatar.kitSecondary}
                              expression={member.avatar.expression}
                              size="sm"
                              upperBodyOnly={true}
                            />
                          </div>

                          {/* Username — canonical flex truncation: the span itself
                              grows and only ellipsizes if genuinely too long. */}
                          {member.flag && <CountryFlag name={member.flag} className="w-5 h-3.5 flex-shrink-0" width={40} />}
                          <span className="text-sm font-black italic text-slate-100 truncate flex-1 min-w-0 pr-2">
                            @{member.username}
                          </span>
                          {member.isCurrentUser && (
                            <span className="text-[7px] font-mono font-bold bg-[#FF4E00] text-white px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                              You
                            </span>
                          )}
                        </div>

                        {/* Scores — primary metric big, secondary small, clearly spaced */}
                        <div className="flex-shrink-0 text-right pl-3">
                          {globalSortBy === "streak" ? (
                            <div className="flex flex-col items-end leading-none gap-1">
                              <span className="text-base font-mono font-black text-[#FF4E00]">🔥 {member.streak}</span>
                              <span className="text-[8px] font-mono text-[#8E9299] uppercase tracking-wide">{member.points.toLocaleString()} pts</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end leading-none gap-1">
                              <span className="text-base font-mono font-black text-indigo-400">{member.points.toLocaleString()}</span>
                              <span className="text-[8px] font-mono text-[#8E9299] uppercase tracking-wide">{member.streak} streak</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 bg-[#151B2E]/20 rounded-3xl border border-white/5">
                    <span className="text-3xl">🔍</span>
                    <h4 className="text-xs font-black italic uppercase text-slate-400 mt-3">No Arena results found</h4>
                    <p className="text-[9px] text-[#8E9299] mt-1 max-w-[200px] mx-auto leading-relaxed uppercase font-bold tracking-wider">
                      Verify username and try again
                    </p>
                  </div>
                )}
              </div>

              {/* User Standing Footer Highlight — real rank + both metrics */}
              {!searchQuery && (() => {
                const myRank = getGlobalStandings().find((m) => m.isCurrentUser)?.rank;
                return (
                  <div className="bg-[#1C233D] border-t border-white/10 p-4.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-[#FF4E00]/10 border border-[#FF4E00]/20 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                        🔥
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8px] font-mono font-black text-[#8E9299] uppercase tracking-widest block leading-none">
                          Your Current Ranking
                        </span>
                        <span className="text-xs font-black italic text-white uppercase tracking-tight block mt-1 whitespace-nowrap">
                          Rank <span className="text-[#FF4E00]">{myRank ? `#${myRank}` : "—"}</span> in the world
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[9px] font-mono text-[#8E9299] uppercase block leading-none">
                        Streak / Points
                      </span>
                      <span className="text-xs font-mono font-black block mt-1 whitespace-nowrap">
                        <span className="text-[#FF4E00]">🔥 {streak}</span>
                        <span className="text-[#8E9299]"> · </span>
                        <span className="text-indigo-400">{points.toLocaleString()} PTS</span>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Round Champion Race modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {raceRound && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0A0E1A]/95 backdrop-blur-md z-50 flex items-center justify-center p-0 md:p-6"
            onClick={() => setRaceRound(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#151B2E] border border-white/10 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-[#1C233D] border-b border-white/5 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-2.5 rounded-2xl text-[#FF4E00]">
                    <Crown className="w-5 h-5 text-[#FF4E00]" />
                  </div>
                  <div>
                    <h2 className="text-base font-black italic text-white uppercase tracking-tight">
                      {raceRound} Champion
                    </h2>
                    <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-wider block">
                      Most correct picks this round
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRaceRound(null)}
                  className="p-2 bg-[#0A0E1A] hover:bg-[#FF4E00]/20 border border-white/5 hover:border-[#FF4E00]/30 rounded-full text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto flex-grow space-y-3">
                {/* Round-round eligibility note */}
                {!CHAMPION_ROUNDS.has(raceRound) && (
                  <div className="bg-[#0A0E1A] border border-white/5 rounded-2xl p-3 text-[10px] text-[#8E9299] leading-relaxed">
                    The {raceRound} is decided by too few matches to crown a Round Champion — glory here comes as a prestige badge instead.
                  </div>
                )}

                {/* Crowned banner */}
                {raceData?.crowned && (
                  <div className="bg-gradient-to-r from-[#FF4E00]/15 to-amber-400/10 border border-[#FF4E00]/30 rounded-2xl p-4 flex items-center gap-3">
                    <Crown className="w-6 h-6 text-[#FF4E00] flex-shrink-0" />
                    <p className="text-xs text-slate-200 leading-relaxed">
                      <span className="font-black italic text-white">@{raceData.crowned.username}</span> is crowned {raceRound} Champion with{" "}
                      <span className="font-black text-[#FF4E00]">{raceData.crowned.correctCount}</span> correct picks. 🏆
                    </p>
                  </div>
                )}

                {raceLoading && (
                  <div className="py-10 text-center text-[11px] font-mono text-[#8E9299] uppercase tracking-widest">Loading the race…</div>
                )}

                {!raceLoading && raceData && raceData.racers.length === 0 && (
                  <div className="py-10 text-center space-y-2">
                    <Trophy className="w-10 h-10 text-white/15 mx-auto" />
                    <p className="text-[11px] text-[#8E9299] leading-relaxed max-w-[240px] mx-auto">
                      No results in yet. Lock in your {raceRound} picks — the race begins when matches finish.
                    </p>
                  </div>
                )}

                {!raceLoading && raceData && raceData.racers.map((r, i) => (
                  <div
                    key={`${r.username}-${i}`}
                    className={`flex items-center gap-3 rounded-2xl p-3 border transition ${
                      r.isCurrentUser
                        ? "bg-[#FF4E00]/10 border-[#FF4E00]/30"
                        : "bg-[#0A0E1A] border-white/5"
                    }`}
                  >
                    <span className={`w-6 text-center text-sm font-black italic ${i === 0 ? "text-[#FF4E00]" : "text-[#8E9299]"}`}>
                      {i === 0 ? "🏆" : i + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-[#151B2E] border border-white/5 p-0.5 flex items-center justify-center flex-shrink-0">
                      <AvatarRenderer
                        skinTone={r.avatar?.skinTone}
                        kitPrimary={r.avatar?.kitPrimary}
                        kitSecondary={r.avatar?.kitSecondary}
                        expression={r.avatar?.expression}
                        size="sm"
                        isAnimated={false}
                        upperBodyOnly={true}
                      />
                    </div>
                    <div className="flex-grow min-w-0">
                      <span className="text-xs font-black italic text-white truncate block">
                        @{r.username}{r.isCurrentUser && <span className="text-[#FF4E00]"> (you)</span>}
                      </span>
                      <span className="text-[9px] font-mono text-[#8E9299]">
                        {r.picksMade} picked · {r.streak}🔥 streak
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black text-[#FF4E00] block leading-none">{r.correctCount}</span>
                      <span className="text-[8px] font-mono text-[#8E9299] uppercase tracking-wide">correct</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
