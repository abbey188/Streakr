"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { FeedItem, RosterPlayer } from "../types";
import CountryFlag from "./CountryFlag";

/**
 * Starting-lineup roster, opened by tapping a "Lineups in" feed card. Renders
 * the frozen roster snapshot (payload.A / payload.B) — starting XI first, then
 * the bench — for both teams. Portaled + scroll-locked like the share sheet.
 */
function TeamColumn({ name, teamName, players }: { name: string; teamName: string; players: RosterPlayer[] }) {
  const xi = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);
  const Row = (p: RosterPlayer) => (
    <div key={`${p.n}-${p.name}`} className="flex items-start gap-2 py-1">
      <span className="w-5 text-right font-mono text-[10px] text-[#8E9299] tabular-nums flex-shrink-0 pt-px">{p.n ?? "–"}</span>
      <span className="text-[12px] text-slate-200 leading-tight">{p.name}</span>
      {p.pos === "GK" && <span className="ml-auto text-[8px] font-mono font-bold text-[#8E9299] uppercase tracking-wider flex-shrink-0 pt-0.5">GK</span>}
    </div>
  );
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
        <CountryFlag name={teamName} className="w-5 h-3.5 flex-shrink-0" />
        <span className="text-[12px] font-black italic uppercase tracking-tight text-[#FF4E00] leading-tight">{name}</span>
      </div>
      <div>{xi.map(Row)}</div>
      {bench.length > 0 && (
        <>
          <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-[#8E9299] mt-3 mb-1">Subs</div>
          <div className="opacity-70">{bench.map(Row)}</div>
        </>
      )}
    </div>
  );
}

export default function LineupModal({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const b = document.body;
    const scrollY = window.scrollY;
    const prev = { position: b.style.position, top: b.style.top, width: b.style.width, overflow: b.style.overflow };
    b.style.position = "fixed"; b.style.top = `-${scrollY}px`; b.style.width = "100%"; b.style.overflow = "hidden";
    return () => {
      b.style.position = prev.position; b.style.top = prev.top; b.style.width = prev.width; b.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (!mounted) return null;
  const m = item.match;
  const p = item.payload as { A?: RosterPlayer[]; B?: RosterPlayer[] };

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      style={{ top: "var(--app-top, 0px)", height: "var(--app-h, 100dvh)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-full overflow-y-auto bg-[#0C1224] border border-white/10 rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Starting Lineups</h3>
          <button onClick={onClose} aria-label="Close" className="text-[#8E9299] hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-4">
          <TeamColumn name={m.teamA.name} teamName={m.teamA.name} players={p.A ?? []} />
          <TeamColumn name={m.teamB.name} teamName={m.teamB.name} players={p.B ?? []} />
        </div>
      </div>
    </div>,
    document.body
  );
}
