"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchAnnouncements, type Announcement } from "@/lib/api/client";

/**
 * Glanceable, dismissible announcement strip — backend-drivable tips/updates.
 * Shows the single highest-priority announcement the user hasn't dismissed.
 * Dismissal is per-device (localStorage), mirroring the "Your Latest Results" strip.
 * Fully defensive: fetch/parse failures render nothing.
 */

const DISMISS_KEY = "streakr_dismissed_announcements";

const KIND: Record<string, { ring: string; bg: string; accent: string }> = {
  info: { ring: "border-[#FF4E00]/30", bg: "bg-[#FF4E00]/[0.06]", accent: "text-[#FF4E00]" },
  tip: { ring: "border-[#FF4E00]/30", bg: "bg-[#FF4E00]/[0.06]", accent: "text-[#FF4E00]" },
  warning: { ring: "border-amber-500/30", bg: "bg-amber-500/[0.06]", accent: "text-amber-400" },
  update: { ring: "border-indigo-500/30", bg: "bg-indigo-500/[0.06]", accent: "text-indigo-300" },
};

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed());
    fetchAnnouncements().then(setItems).catch(() => {});
  }, []);

  const active = items.find((a) => !dismissed.has(a.id));
  if (!active) return null;

  const style = KIND[active.kind] ?? KIND.info;
  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(active.id);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${style.ring} ${style.bg} p-3.5`}>
      <span className="text-lg leading-none flex-shrink-0 mt-0.5">{active.icon || "📣"}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black uppercase tracking-tight ${style.accent}`}>{active.title}</p>
        <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">{active.body}</p>
        {active.ctaLabel && active.ctaHref && (
          <a
            href={active.ctaHref}
            className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-black ${style.accent} hover:underline`}
          >
            {active.ctaLabel} →
          </a>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="flex-shrink-0 p-1 -mr-1 text-[#A2A7AF] hover:text-white transition cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
