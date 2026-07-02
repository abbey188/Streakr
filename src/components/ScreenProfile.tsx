import React, { useState } from "react";
import { AvatarConfig } from "../types";
import AvatarRenderer from "./AvatarRenderer";
import AvatarCustomizer from "./AvatarCustomizer";
import { BADGES } from "../data/fixtures";
import { Award, Flame, Trophy, Settings, Share2, Pen, User, LogOut, Bell, Clock, Target, CheckCircle2, Medal, Users } from "lucide-react";
import { NOTIF_TYPES } from "@/lib/db/notify-prefs";

// Lucide icon per notification type — matches the app's icon language.
const NOTIF_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  match_start: Clock,
  goal: Target,
  pick_result: CheckCircle2,
  badge: Medal,
  round_champion: Trophy,
  group: Users,
};
import { motion, AnimatePresence } from "motion/react";

interface ScreenProfileProps {
  avatar: AvatarConfig;
  streak: number;
  personalBest: number;
  points: number;
  userEmail?: string;
  walletAddress?: string;
  earnedBadgeIds?: string[];
  notificationPrefs?: Record<string, boolean>;
  onUpdateNotificationPrefs?: (prefs: Record<string, boolean>) => void;
  onUpdateAvatar: (newConfig: AvatarConfig) => void;
  onOpenStreakShare: () => void;
  onSignOut?: () => void;
}

export default function ScreenProfile({
  avatar,
  streak,
  personalBest,
  points,
  userEmail = "abiodunlawal188@gmail.com",
  walletAddress,
  earnedBadgeIds = [],
  notificationPrefs = {},
  onUpdateNotificationPrefs,
  onUpdateAvatar,
  onOpenStreakShare,
  onSignOut,
}: ScreenProfileProps) {
  const earnedBadges = new Set(earnedBadgeIds);
  // A type is ON unless explicitly false.
  const prefOn = (key: string) => notificationPrefs[key] !== false;
  const togglePref = (key: string) =>
    onUpdateNotificationPrefs?.({ ...notificationPrefs, [key]: !prefOn(key) });
  const [showEditor, setShowEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editing the mascot saves the FULL config (incl. jersey number + headgear)
  // via the shared customizer, then closes the modal.
  const handleSaveEditor = (config: AvatarConfig) => {
    onUpdateAvatar(config);
    setShowEditor(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-12 relative">
      {/* Visual background gradient circle */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#FF4E00]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Screen Title Header */}
      <div className="sticky top-0 bg-[#0A0E1A]/85 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between z-30">
        <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">
          My Profile
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151B2E] hover:bg-[#2D364F]/70 border border-white/5 rounded-xl text-[10px] font-mono text-slate-300 hover:text-white font-bold uppercase tracking-wider transition cursor-pointer"
          id="profile-settings-btn"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>

      <div className="px-4 mt-4 space-y-6 flex-grow z-10 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Fan Card Avatar Card */}
          <div className="lg:col-span-1">
            {/* Profile Card Shell */}
            <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 shadow-xl text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#FF4E00]/5 rounded-bl-full" />
              
              {/* Main Avatar Render */}
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-[#0A0E1A] border border-white/5 rounded-2xl shadow-inner relative group">
                  <AvatarRenderer
                    skinTone={avatar.skinTone}
                    kitPrimary={avatar.kitPrimary}
                    kitSecondary={avatar.kitSecondary}
                    expression={avatar.expression}
                    jerseyNumber={avatar.jerseyNumber}
                    headgear={avatar.headgear}
                    size="lg"
                    isAnimated={true}
                  />
                  {/* Tap to edit badge */}
                  <button
                    onClick={() => setShowEditor(true)}
                    className="absolute bottom-2 right-2 bg-[#FF4E00] hover:bg-orange-655 text-white p-2.5 rounded-xl border-2 border-[#0A0E1A] shadow transition cursor-pointer"
                    id="profile-edit-avatar-badge"
                  >
                    <Pen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black italic text-white mb-2">@{avatar.username}</h3>

              {/* 3-Column Key stats */}
              <div className="grid grid-cols-3 gap-2 mt-5">
                {/* Active Streak */}
                <div className="bg-[#0A0E1A] border border-[#FF4E00]/10 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                  <Flame className="w-5 h-5 text-[#FF4E00] fill-[#FF4E00]/20 mb-1" />
                  <span className="text-[9px] font-black italic text-[#8E9299] uppercase tracking-wider block text-center leading-tight">
                    Active Streak
                  </span>
                  <span className="text-lg font-black font-mono text-[#FF4E00] mt-0.5">
                    {streak}
                  </span>
                </div>

                {/* Personal Best */}
                <div className="bg-[#0A0E1A] border border-yellow-500/10 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                  <span className="text-[9px] font-black italic text-[#8E9299] uppercase tracking-wider block text-center leading-tight">
                    Personal Best
                  </span>
                  <span className="text-lg font-black font-mono text-yellow-400 mt-0.5">
                    {personalBest}
                  </span>
                </div>

                {/* Total Points */}
                <div className="bg-[#0A0E1A] border border-indigo-500/10 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                  <Award className="w-5 h-5 text-indigo-400 mb-1" />
                  <span className="text-[9px] font-black italic text-[#8E9299] uppercase tracking-wider block text-center leading-tight">
                    Total Points
                  </span>
                  <span className="text-lg font-black font-mono text-indigo-400 mt-0.5">
                    {points}P
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={onOpenStreakShare}
                  className="w-full bg-gradient-to-r from-[#FF4E00] to-orange-500 hover:from-orange-600 hover:to-orange-550 text-white font-black italic text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-[0_4px_12px_rgba(255,78,0,0.2)]"
                  id="profile-share-streak-btn"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Streak Card
                </button>

                <button
                  onClick={() => setShowEditor(true)}
                  className="w-full bg-[#0A0E1A] hover:bg-[#2D364F]/50 border border-white/5 text-slate-300 hover:text-white font-black italic text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  id="profile-edit-pfp-btn"
                >
                  Customize Avatar Outfit
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Badges */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between pl-1">
              <h4 className="text-[10px] font-mono font-black text-[#8E9299] uppercase tracking-widest">
                Badges
              </h4>
              <span className="text-[9px] font-mono font-bold text-[#8E9299]">
                <span className="text-[#FF4E00]">{earnedBadges.size}</span> / {BADGES.length} earned
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BADGES.map((badge) => {
                // A badge only lights up once the user has actually earned it.
                const isEarned = earnedBadges.has(badge.id);

                return (
                  <div
                    key={badge.id}
                    className={`bg-[#151B2E] border border-white/5 p-4 rounded-2xl flex flex-col justify-between h-[120px] shadow relative overflow-hidden transition-all duration-200 hover:border-white/10 ${
                      isEarned ? "" : "opacity-45 grayscale"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{badge.icon}</span>
                      {isEarned ? (
                        <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                          Earned
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold bg-[#0A0E1A] text-slate-500 border border-white/5 px-2 py-0.5 rounded-full uppercase">
                          Locked
                        </span>
                      )}
                    </div>

                    <div>
                      <h5 className="text-xs font-black italic text-white mt-2">{badge.name}</h5>
                      <p className="text-[9px] text-[#8E9299] leading-tight mt-0.5">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL AVATAR EDITOR — uses the SAME shared customizer as the
          create-fan-identity flow, so the two are always identical. */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed inset-0 bg-[#0A0E1A] z-[60] flex flex-col overflow-y-auto"
          >
            {/* Sticky header */}
            <div className="sticky top-0 bg-[#0A0E1A]/90 backdrop-blur-md border-b border-white/5 px-5 py-4 flex items-center justify-between z-10">
              <span className="text-xs font-mono font-bold text-[#8E9299] uppercase tracking-wider">
                Identity Customizer
              </span>
              <button
                onClick={() => setShowEditor(false)}
                className="p-1.5 bg-[#2D364F]/50 border border-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Shared customizer, seeded with the current mascot so nothing is
                lost on save (jersey number + headgear included). */}
            <div className="flex-grow flex flex-col justify-center px-5 py-6">
              <AvatarCustomizer
                initialConfig={avatar}
                confirmLabel="Confirm Changes"
                onConfirm={handleSaveEditor}
              />
            </div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 25 }}
            className="fixed inset-0 bg-[#0A0E1A] z-[60] flex flex-col overflow-y-auto pb-12 text-left"
          >
            {/* Sticky Header — single close control (Done) */}
            <div className="sticky top-0 bg-[#0A0E1A]/90 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between z-30">
              <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">
                Profile Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[10px] font-mono text-[#FF4E00] font-bold uppercase tracking-widest bg-[#FF4E00]/10 hover:bg-[#FF4E00]/20 px-3 py-1.5 rounded-xl border border-[#FF4E00]/20 transition cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Visual background gradient circle */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#FF4E00]/5 rounded-full blur-3xl pointer-events-none" />

            {/* Content Body Centered */}
            <div className="px-4 mt-6 space-y-6 flex-grow z-10 max-w-xl mx-auto w-full">
              {/* Account Credentials */}
              <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-[#FF4E00]">
                  <User className="w-4 h-4" />
                  <h4 className="text-xs font-black italic uppercase tracking-wider text-slate-200">
                    Account Identity
                  </h4>
                </div>
                <div className="space-y-3.5 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-[8px] font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      Connected Email / Login
                    </span>
                    <span className="text-xs font-mono font-black text-white block mt-1">
                      {userEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      League Username
                    </span>
                    <span className="text-sm font-black text-white block mt-0.5">
                      @{avatar.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Solana Connected/Embedded Wallet */}
              <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
                <div className="flex items-center gap-2 text-emerald-400">
                  <svg className="w-4 h-4 fill-emerald-400" viewBox="0 0 397 311" xmlns="http://www.w3.org/2000/svg">
                    <path d="M64.71 0h326.62l-64.44 55.43H3.45L64.71 0zM3.45 127.7h327.18l64.44 55.42H64.71L3.45 127.7zm61.26 127.71h326.62l-64.44 55.43H3.45l61.26-55.43z" />
                  </svg>
                  <h4 className="text-xs font-black italic uppercase tracking-wider text-slate-200">
                    Embedded Solana Wallet
                  </h4>
                </div>
                
                <div className="border-t border-white/5 pt-3.5 space-y-3">
                  <div>
                    <span className="text-[8px] font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      Solana Wallet Address
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-1.5 bg-[#0A0E1A] p-2.5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-mono text-[#8E9299] block font-bold truncate">
                        {walletAddress
                          ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-6)}`
                          : "Wallet not connected"}
                      </span>
                      <button
                        onClick={() => {
                          if (!walletAddress) return;
                          navigator.clipboard.writeText(walletAddress);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        disabled={!walletAddress}
                        className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[9px] font-mono font-bold text-emerald-400 transition cursor-pointer min-w-[55px] text-center flex-shrink-0 disabled:opacity-40"
                      >
                        {copied ? "Copied!" : "Copy Address"}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                    <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                      Status: Connected & Secured
                    </span>
                    <span className="text-[8px] font-mono text-[#8E9299] uppercase">
                      Solana Mainnet
                    </span>
                  </div>
                </div>
              </div>

              {/* Notification preferences */}
              <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-[#FF4E00]">
                  <Bell className="w-4 h-4" />
                  <h4 className="text-xs font-black italic uppercase tracking-wider text-slate-200">
                    Notifications
                  </h4>
                </div>
                <p className="text-[9px] text-[#8E9299] leading-relaxed -mt-2">
                  Choose what you get pinged about. Everything's on by default.
                </p>
                <div className="space-y-3 border-t border-white/5 pt-3">
                  {NOTIF_TYPES.map((t) => {
                    const on = prefOn(t.key);
                    const Icon = NOTIF_ICONS[t.key];
                    return (
                      <div key={t.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {Icon && (
                            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-[#FF4E00]">
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-300 block">
                              {t.label}
                            </span>
                            <span className="text-[8.5px] text-[#8E9299] block mt-0.5 leading-tight">
                              {t.description}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePref(t.key)}
                          aria-pressed={on}
                          className={`w-9 h-5 rounded-full p-[2px] flex items-center transition flex-shrink-0 cursor-pointer ${
                            on ? "bg-emerald-500 justify-end" : "bg-[#2D364F] justify-start"
                          }`}
                        >
                          <div className="w-4 h-4 bg-white rounded-full shadow" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={onSignOut}
                className="w-full bg-[#151B2E] hover:bg-red-950/30 border border-white/5 hover:border-red-500/30 text-slate-300 hover:text-red-400 font-black italic text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xl"
                id="profile-sign-out-btn"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline fallback X icon
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={props.className}
      style={{ width: "16px", height: "16px" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
