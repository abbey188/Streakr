import React from "react";
import type { MomentAttachment } from "../types";
import { momentTone } from "@/lib/social/moment";
import CountryFlag from "./CountryFlag";

/**
 * A shared Live-Feed moment rendered as a compact card — used in the share
 * sheet preview and above a shared message in the Squad Room. Renders the frozen
 * snapshot (icon/label/text + score at share time), so it reads on its own
 * forever, independent of later feed state.
 */
export default function MomentAttachmentCard({ att, className = "" }: { att: MomentAttachment; className?: string }) {
  return (
    <div className={`flex gap-2.5 items-start bg-[#0A0E1A] border border-white/10 rounded-xl p-2.5 ${className}`}>
      <div className="w-7 h-7 rounded-lg grid place-items-center text-[14px] bg-[#151B2E] border border-white/5 flex-shrink-0">
        {att.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[7.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${momentTone(att.type)}`}>
            {att.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-slate-300 tabular-nums">
            <CountryFlag name={att.teamAName} className="w-3 h-2" />
            {att.teamACode} {att.scoreA}–{att.scoreB} {att.teamBCode}
            <CountryFlag name={att.teamBName} className="w-3 h-2" />
          </span>
          {att.minute != null && <span className="text-[8.5px] font-mono text-[#8E9299]">· {att.minute}&apos;</span>}
        </div>
        <div className="text-[11.5px] text-slate-200 mt-0.5 leading-snug">{att.text}</div>
      </div>
    </div>
  );
}
