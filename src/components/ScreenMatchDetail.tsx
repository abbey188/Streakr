"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { motion } from "motion/react";
import type { MatchEvent, FormEntry } from "@/lib/txline/types";
import { fetchMatchDetail, type MatchDetailResponse } from "@/lib/api/client";
import { useAppState } from "@/lib/state/app-state";
import { formatMinute } from "@/lib/live-clock";
import CountryFlag from "./CountryFlag";

interface ScreenMatchDetailProps {
  fixtureId: string;
  onBack: () => void;
}

const EVENT_ICON: Record<string, string> = {
  goal: "⚽", penalty: "🥅", yellow: "🟨", red: "🟥", sub: "🔁", var: "📺", corner: "🚩", freekick: "🎯", shot: "💥",
};
const EVENT_LABEL: Record<string, string> = {
  goal: "Goal", penalty: "Penalty", yellow: "Yellow card", red: "Red card", sub: "Substitution", var: "VAR", corner: "Corner", freekick: "Free kick", shot: "Shot",
};

function TeamFormRow({ code, name, form }: { code: string; name: string; form: FormEntry[] }) {
  const dots = [...form].reverse(); // oldest → newest (SofaScore-style)
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-black text-slate-200 flex items-center gap-1.5">
        <CountryFlag name={name} className="w-5 h-3.5" width={40} /> {code}
      </span>
      <div className="flex items-center gap-1">
        {dots.length === 0 ? (
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">No recent data</span>
        ) : (
          dots.map((f, i) => (
            <span
              key={i}
              title={`${f.scoreFor}-${f.scoreAgainst} vs ${f.opponentCode}`}
              className={`w-[18px] h-[18px] rounded-md text-[8.8px] font-black flex items-center justify-center ${
                f.result === "W"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : f.result === "L"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-slate-500/20 text-slate-300"
              }`}
            >
              {f.result}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function StatRow({ label, a, b }: { label: string; a: number; b: number }) {
  const total = a + b || 1;
  const aPct = Math.round((a / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-black">
        <span className="text-white font-mono w-8 text-left">{a}</span>
        <span className="text-[9px] font-mono text-[#A2A7AF] uppercase tracking-wider">{label}</span>
        <span className="text-white font-mono w-8 text-right">{b}</span>
      </div>
      <div className="flex items-center gap-1 h-1.5">
        <div className="flex-1 bg-[#0A0E1A] rounded-full overflow-hidden flex justify-end">
          <div className="h-full bg-[#FF4E00] rounded-full" style={{ width: `${aPct}%` }} />
        </div>
        <div className="flex-1 bg-[#0A0E1A] rounded-full overflow-hidden">
          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${100 - aPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function ScreenMatchDetail({ fixtureId, onBack }: ScreenMatchDetailProps) {
  const app = useAppState();
  const [data, setData] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "timeline">("stats");

  const userPick = app.fixtures.find((f) => f.id === fixtureId)?.userPick;

  const load = useCallback(async () => {
    try {
      const d = await fetchMatchDetail(fixtureId);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => { load(); }, [load]);

  const detail = data?.detail ?? null;
  const formA = data?.formA ?? [];
  const formB = data?.formB ?? [];

  // Poll fast while the match is live so the watched game feels real-time
  // (the per-match snapshot is cheap). Cron drives the rest of the app.
  useEffect(() => {
    // Poll while the match is IN PLAY — including halftime, so we catch the
    // second-half kickoff and don't freeze on the HT state.
    const st = detail?.score.status;
    if (st !== "live" && st !== "halftime") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [detail?.score.status, load]);

  const s = detail?.score;
  const isLive = s?.status === "live";
  const isHalftime = s?.status === "halftime";
  const isFinished = s?.status === "finished";
  const inPlay = isLive || isHalftime; // match underway (score + live styling)
  const showPens = s?.homePenalties !== undefined && s?.awayPenalties !== undefined;

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-12">
      {/* Header */}
      <div className="sticky top-0 bg-[#0A0E1A]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3 z-30">
        <button onClick={onBack} className="p-1.5 bg-[#151B2E] hover:bg-[#2D364F]/70 border border-white/5 rounded-xl text-slate-300 hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">
          {detail?.round ?? "Match"}
        </h2>
      </div>

      {loading || !detail || !s ? (
        <div className="flex-grow flex items-center justify-center py-20 text-[10px] font-mono text-[#A2A7AF] uppercase tracking-widest">
          Loading match…
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-5 max-w-2xl mx-auto w-full">
          {/* Scoreboard */}
          <div className={`bg-[#151B2E] border rounded-3xl p-5 shadow-xl relative overflow-hidden ${inPlay ? "border-red-500/30 ring-1 ring-red-500/15" : "border-white/5"}`}>
            <div className="flex justify-center mb-3">
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE • {formatMinute(s.minute, s.period)}{s.period?.startsWith("ET") ? ` · ${s.period}` : ""}
                </span>
              ) : isHalftime ? (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> HALF TIME
                </span>
              ) : isFinished ? (
                <span className="text-[9px] font-mono text-[#A2A7AF] font-bold uppercase bg-[#0A0E1A] px-2.5 py-0.5 rounded-full border border-white/5">
                  {s.period === "PENS" ? "After Penalties" : s.period === "AET" ? "After Extra Time" : "Full Time"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                  <Clock className="w-2.5 h-2.5" /> {detail.kickoffTime}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center text-center w-[36%]">
                <CountryFlag name={detail.teamA.name} className="w-11 h-8 mb-2" width={160} />
                <span className="text-xs font-black text-white uppercase tracking-tight leading-tight">{detail.teamA.name}</span>
              </div>

              <div className="flex flex-col items-center px-2">
                {isFinished || inPlay ? (
                  <span className={`text-4xl font-mono font-black tracking-wider ${isLive ? "text-red-500" : "text-white"}`}>
                    {s.homeScore}<span className="text-[#A2A7AF] mx-1">-</span>{s.awayScore}
                  </span>
                ) : (
                  <span className="text-lg font-mono font-bold text-[#A2A7AF]">{detail.kickoffTime}</span>
                )}
                {showPens && (
                  // Secondary scoreline: numbers stacked under the main score (never
                  // wraps in the narrow centre column), with a small label beneath.
                  <div className="mt-1.5 flex flex-col items-center">
                    <span className="text-sm font-mono font-black text-[#FF4E00] tracking-wider whitespace-nowrap">
                      {s.homePenalties}
                      <span className="text-[#FF4E00]/50 mx-1.5">-</span>
                      {s.awayPenalties}
                    </span>
                    <span className="text-[8.8px] font-mono font-bold text-[#A2A7AF] uppercase tracking-widest mt-0.5 leading-none">
                      Penalties
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center text-center w-[36%]">
                <CountryFlag name={detail.teamB.name} className="w-11 h-8 mb-2" width={160} />
                <span className="text-xs font-black text-white uppercase tracking-tight leading-tight">{detail.teamB.name}</span>
              </div>
            </div>

            {/* Advanced / your pick */}
            {isFinished && s.advanced && (
              <div className="mt-4 pt-3 border-t border-white/5 text-center">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                  {(s.advanced === "A" ? detail.teamA.name : detail.teamB.name)} advances
                </span>
              </div>
            )}
            {userPick && (
              <div className="mt-3 flex justify-center">
                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                  isFinished
                    ? userPick === s.advanced
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-[#FF4E00]/10 text-[#FF4E00] border-[#FF4E00]/20"
                }`}>
                  Your pick: {userPick === "A" ? detail.teamA.code : detail.teamB.code}
                  {isFinished ? (userPick === s.advanced ? " ✓ WON" : " ✗ LOST") : ""}
                </span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#151B2E] border border-white/5 p-1.5 rounded-2xl">
            {(["stats", "timeline"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${tab === t ? "bg-[#FF4E00] text-white shadow" : "text-[#A2A7AF] hover:text-white"}`}
              >
                {t === "timeline" ? "Timeline" : "Stats"}
              </button>
            ))}
          </div>

          {tab === "timeline" ? (
            <div className="space-y-2">
              {detail.events.length === 0 ? (
                <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-6 text-center text-[10px] font-mono text-[#A2A7AF] uppercase tracking-wider">
                  {s.status === "upcoming"
                    ? "Match hasn't kicked off yet."
                    : "Underway — no key events yet. Goals, cards & subs appear here."}
                </div>
              ) : (
                detail.events.map((e: MatchEvent) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#151B2E] border border-white/5 rounded-2xl px-3 py-2.5 flex items-center gap-3"
                  >
                    <span className="text-[10px] font-mono font-black text-[#A2A7AF] w-8 text-center flex-shrink-0">{e.minute}'</span>
                    <span className="text-base flex-shrink-0">{EVENT_ICON[e.type] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black text-white">{EVENT_LABEL[e.type] ?? e.type}</span>
                      {e.detail && <span className="text-[10px] text-[#A2A7AF] ml-1.5">{e.detail}</span>}
                    </div>
                    <CountryFlag name={e.team === "A" ? detail.teamA.name : detail.teamB.name} className="w-5 h-3.5 flex-shrink-0" width={40} />
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recent form */}
              <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 space-y-3">
                <h4 className="text-[9px] font-mono font-black text-[#A2A7AF] uppercase tracking-widest">
                  Recent Form
                </h4>
                <TeamFormRow code={detail.teamA.code} name={detail.teamA.name} form={formA} />
                <TeamFormRow code={detail.teamB.code} name={detail.teamB.name} form={formB} />
              </div>

              {/* Match stats */}
              {(detail.score.status !== "upcoming") && (
                <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-[#FF4E00] font-black">{detail.teamA.code}</span>
                    <span className="text-[#A2A7AF]">Match Stats</span>
                    <span className="text-indigo-400 font-black">{detail.teamB.code}</span>
                  </div>
                  {detail.stats.possessionA != null && (
                    <StatRow label="Possession %" a={detail.stats.possessionA} b={detail.stats.possessionB ?? 0} />
                  )}
                  <StatRow label="Shots" a={detail.stats.shotsA ?? 0} b={detail.stats.shotsB ?? 0} />
                  <StatRow label="Shots on Target" a={detail.stats.shotsOnTargetA ?? 0} b={detail.stats.shotsOnTargetB ?? 0} />
                  <StatRow label="Corners" a={detail.stats.cornersA ?? 0} b={detail.stats.cornersB ?? 0} />
                  <StatRow label="Offsides" a={detail.stats.offsidesA ?? 0} b={detail.stats.offsidesB ?? 0} />
                  <StatRow label="Yellow Cards" a={detail.stats.yellowA ?? 0} b={detail.stats.yellowB ?? 0} />
                  <StatRow label="Red Cards" a={detail.stats.redA ?? 0} b={detail.stats.redB ?? 0} />
                  <p className="text-[8.8px] font-mono text-slate-500 text-center pt-1 uppercase tracking-wider">
                    Verified on-chain via TxLINE
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
