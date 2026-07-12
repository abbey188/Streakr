import React, { useState, useEffect } from "react";
import { ActivityItem, Notification as NotificationItem } from "../types";
import AvatarRenderer from "./AvatarRenderer";
import PushNudge from "./PushNudge";
import { eventPredicate } from "@/lib/social/phrasing";
import { Bell, Trash2 } from "lucide-react";

interface ScreenInboxProps {
  activityList: ActivityItem[];
  notifications?: NotificationItem[];
  /** Clear the user's personal (General) notifications server-side. */
  onClearNotifications?: () => void;
}

const DISMISS_ACTIVITY_KEY = "streakr_dismissed_activity";
// Group activity has no server-side read state (it's a shared feed), so "seen"
// is tracked per-device by id — same pattern as dismissals. Powers the tab badge.
const SEEN_ACTIVITY_KEY = "streakr_seen_activity";

export default function ScreenInbox({
  activityList,
  notifications = [],
  onClearNotifications,
}: ScreenInboxProps) {
  const [tab, setTab] = useState<"general" | "group">("general");
  // Group activity is a shared milestone feed (not per-user rows), so "clearing"
  // it is a local hide (per device), mirroring the results strip.
  const [dismissedActivity, setDismissedActivity] = useState<Set<string>>(new Set());
  const [seenActivity, setSeenActivity] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_ACTIVITY_KEY);
      if (raw) setDismissedActivity(new Set(JSON.parse(raw)));
      const seen = localStorage.getItem(SEEN_ACTIVITY_KEY);
      if (seen) setSeenActivity(new Set(JSON.parse(seen)));
    } catch { /* ignore */ }
  }, []);

  const visibleActivity = activityList.filter((a) => !dismissedActivity.has(a.id));

  // Badge count for the Group tab: items you haven't looked at yet.
  const unseenGroupCount = visibleActivity.filter((a) => !seenActivity.has(a.id)).length;

  // Viewing the Group tab marks everything currently there as seen (badge clears).
  useEffect(() => {
    if (tab !== "group") return;
    const unseen = visibleActivity.filter((a) => !seenActivity.has(a.id));
    if (unseen.length === 0) return;
    const next = new Set(seenActivity);
    unseen.forEach((a) => next.add(a.id));
    setSeenActivity(next);
    try { localStorage.setItem(SEEN_ACTIVITY_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }, [tab, visibleActivity, seenActivity]);

  const clearGroupLocally = () => {
    const next = new Set(dismissedActivity);
    activityList.forEach((a) => next.add(a.id));
    setDismissedActivity(next);
    try { localStorage.setItem(DISMISS_ACTIVITY_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };

  const clearCurrent = () => {
    if (tab === "general") onClearNotifications?.();
    else clearGroupLocally();
  };

  const currentCount = tab === "general" ? notifications.length : visibleActivity.length;

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-12 relative">
      {/* Page Title Row */}
      <div className="sticky top-0 bg-[#0A0E1A]/85 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-1.5 rounded-lg text-[#FF4E00]">
            <Bell className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">Inbox</h2>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4 flex-grow z-10 max-w-7xl mx-auto w-full">

        {/* Real Web Push opt-in — the old card only requested browser permission
            and never subscribed, silently stranding users with no alerts. */}
        <PushNudge />

        {/* Clear-all (top-left) + General / Group tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={clearCurrent}
            disabled={currentCount === 0}
            className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#8E9299] hover:text-red-400 disabled:opacity-30 disabled:hover:text-[#8E9299] disabled:cursor-default transition cursor-pointer flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <div className="flex-1 flex gap-1.5 bg-[#151B2E] border border-white/5 p-1 rounded-2xl">
            {(["general", "group"] as const).map((t) => {
              const active = tab === t;
              const badge = t === "group" ? unseenGroupCount : 0;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-black italic uppercase tracking-wider transition cursor-pointer ${
                    active ? "bg-[#FF4E00] text-white shadow" : "text-[#8E9299] hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {t === "general" ? "General" : "Group"}
                    {badge > 0 && (
                      <span
                        className={`min-w-[15px] h-[15px] px-1 rounded-full text-[8px] font-black not-italic inline-flex items-center justify-center leading-none ${
                          active ? "bg-white text-[#FF4E00]" : "bg-[#FF4E00] text-white"
                        }`}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── General — personal notifications (pick results, goals, crowns) ─── */}
        {tab === "general" && (
          notifications.length === 0 ? (
            <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-6 text-center space-y-1">
              <p className="text-xs font-black italic text-slate-300">You&apos;re all caught up</p>
              <p className="text-[10px] text-[#8E9299] leading-relaxed max-w-[260px] mx-auto">
                Goals, pick results, crowns, and your group&apos;s milestones will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {notifications.map((n) => {
                let accent = "border-white/5";
                if (n.type === "round_champion") accent = "border-amber-400/40 bg-amber-400/5";
                else if (n.type === "badge") accent = "border-purple-500/30 bg-purple-500/5";
                else if (n.type === "goal") accent = "border-emerald-500/30 bg-emerald-500/5";
                else if (n.type === "match_start") accent = "border-sky-500/30 bg-sky-500/5";
                else if (n.type === "pick_result") accent = "border-[#FF4E00]/25 bg-[#FF4E00]/5";
                else if (n.type === "group") accent = "border-indigo-500/30 bg-indigo-500/5";
                else if (n.type === "squad") accent = "border-[#FF4E00]/25 bg-[#FF4E00]/5";
                else if (n.type === "announcement") accent = "border-teal-500/30 bg-teal-500/5";
                return (
                  <div
                    key={n.id}
                    className={`bg-[#151B2E] border-2 ${accent} rounded-3xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden transition-all duration-200 hover:border-white/15`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] border border-white/5 flex items-center justify-center flex-shrink-0 text-xl">
                      {n.icon}
                    </div>
                    <div className="flex-grow min-w-0 space-y-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs font-black italic text-white truncate">{n.title}</span>
                        <span className="text-[9px] font-mono text-[#8E9299] font-medium flex-shrink-0">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{n.body}</p>
                    </div>
                    {!n.read && (
                      // Left edge, vertically centred — reads as an "unread" row marker
                      // and keeps the top-right corner free for the timestamp.
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FF4E00] shadow-[0_0_6px_rgba(255,78,0,0.7)]" />
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ─── Group — read-only milestone feed from your groups ─── */}
        {tab === "group" && (
          visibleActivity.length === 0 ? (
            <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-6 text-center space-y-1">
              <p className="text-xs font-black italic text-slate-300">Nothing from your groups yet</p>
              <p className="text-[10px] text-[#8E9299] leading-relaxed max-w-[260px] mx-auto">
                When a groupmate hits a big streak or gets crowned Round Champion, it&apos;ll show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleActivity.map((item) => {
                let typeBorder = "border-white/5";
                let typeIcon = "📢";
                if (item.type === "milestone") { typeBorder = "border-[#FF4E00]/30 bg-[#FF4E00]/5"; typeIcon = "🔥"; }
                else if (item.type === "win") { typeBorder = "border-amber-500/30 bg-amber-500/5"; typeIcon = "🏆"; }
                else if (item.type === "badge") { typeBorder = "border-purple-500/30 bg-purple-500/5"; typeIcon = "🎖️"; }
                else if (item.type === "break") { typeBorder = "border-red-500/20 bg-red-500/5"; typeIcon = "💀"; }
                return (
                  <div
                    key={item.id}
                    className={`bg-[#151B2E] border-2 ${typeBorder} rounded-3xl p-4 shadow-md relative overflow-hidden transition-all duration-200 hover:border-white/10`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] border border-white/5 p-0.5 flex items-center justify-center flex-shrink-0">
                        <AvatarRenderer
                          skinTone={item.avatar?.skinTone}
                          kitPrimary={item.avatar?.kitPrimary}
                          kitSecondary={item.avatar?.kitSecondary}
                          expression={item.avatar?.expression}
                          size="sm"
                          isAnimated={false}
                          upperBodyOnly={true}
                        />
                      </div>
                      <div className="flex-grow min-w-0 space-y-1">
                        <div className="flex justify-between items-center gap-2">
                          <span className={`text-xs font-black italic truncate ${item.isMine ? "text-[#FF4E00]" : "text-white"}`}>{item.isMine ? "You" : `@${item.username}`}</span>
                          <span className="text-[9px] font-mono text-[#8E9299] font-medium flex-shrink-0">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <span className="pr-1.5">{typeIcon}</span>
                          {eventPredicate(item.message, item.isMine)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
