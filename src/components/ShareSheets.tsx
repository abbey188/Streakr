import React, { useState, useRef } from "react";
import { AvatarConfig, GroupMember } from "../types";
import AvatarRenderer from "./AvatarRenderer";
import { X, Copy, Check, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toPng, toBlob } from "html-to-image";

interface ShareSheetsProps {
  avatar: AvatarConfig;
  streak: number;
  personalBest: number;
  groupName: string;
  inviteCode: string;
  leaderboard: GroupMember[];
  onClose: () => void;
  defaultTab?: "streak" | "invite";
  isOnlyStreak?: boolean;
  isOnlyInvite?: boolean;
  groupEmoji?: string;
}

export default function ShareSheets({
  avatar,
  streak,
  personalBest,
  groupName,
  inviteCode,
  leaderboard,
  onClose,
  defaultTab = "streak",
  isOnlyStreak = false,
  isOnlyInvite = false,
  groupEmoji = "🏆",
}: ShareSheetsProps) {
  const initialTab = isOnlyStreak ? "streak" : (isOnlyInvite ? "invite" : defaultTab);
  const [activeTab, setActiveTab] = useState<"streak" | "invite">(initialTab);
  const [copiedText, setCopiedText] = useState("");
  const [busy, setBusy] = useState(false);
  // One card is mounted at a time (AnimatePresence mode="wait"), so a single ref
  // always points at whichever card is currently visible.
  const cardRef = useRef<HTMLDivElement>(null);

  const flashMsg = (msg: string) => {
    setCopiedText(msg);
    setTimeout(() => setCopiedText(""), 2200);
  };

  const handleTriggerCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText?.(text);
    setCopiedText(label);
    setTimeout(() => {
      setCopiedText("");
    }, 2000);
  };

  // Real share links are built from the live origin, so they become valid the
  // moment we deploy (localhost in dev, streakr.app in prod). Fallback keeps the
  // card readable before the domain is live.
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://streakr.app";
  const shareUrl =
    activeTab === "streak"
      ? `${origin}/play`
      : `${origin}/join?code=${encodeURIComponent(inviteCode)}`;
  const shareText =
    activeTab === "streak"
      ? `🔥 I'm on a ${streak}-match World Cup '26 streak on STREAKR. Think you can beat it?`
      : `⚽ Join my STREAKR squad "${groupName}" — code ${inviteCode}. Let's see who reads the World Cup best!`;

  const fileName =
    activeTab === "streak"
      ? `streakr-streak-${avatar.username || "card"}.png`
      : `streakr-invite-${inviteCode}.png`;

  // Render the visible card to a PNG and trigger a download. Returns success.
  const saveImage = async (): Promise<boolean> => {
    if (!cardRef.current) return false;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0A0E1A" });
      const a = document.createElement("a");
      a.download = fileName;
      a.href = dataUrl;
      a.click();
      return true;
    } catch {
      return false;
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await saveImage();
    setBusy(false);
    flashMsg(ok ? "Image saved! 📸" : "Couldn't save image — try again");
  };

  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(shareUrl)}&hashtags=Streakr,WorldCup26`;

  const handleShareToX = async () => {
    if (busy) return;
    setBusy(true);
    // Mobile: share the actual image straight to the X app via the native sheet.
    try {
      if (cardRef.current && typeof navigator !== "undefined" && navigator.canShare) {
        const blob = await toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0A0E1A" });
        if (blob) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: shareText, url: shareUrl });
            setBusy(false);
            return;
          }
        }
      }
    } catch {
      /* user cancelled or unsupported — fall through to desktop flow */
    }
    // Desktop: X can't attach an image via URL, so just open the composer with
    // the text + link. No forced download — Download is its own separate button.
    setBusy(false);
    if (typeof window !== "undefined") window.open(intentUrl, "_blank", "noopener,noreferrer");
    flashMsg("Opening X…");
  };

  // Format top leaderboard members for invite card
  const topMembers = [...leaderboard]
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  return (
    <div className="absolute inset-0 bg-[#0A0E1A]/95 z-50 flex flex-col justify-between p-5 overflow-y-auto">
      {/* Top controls row */}
      <div className="flex items-center justify-between">
        {!(isOnlyStreak || isOnlyInvite) ? (
          <div className="grid grid-cols-2 gap-1 bg-[#151B2E] border border-white/5 p-1 rounded-xl w-[250px]">
            <button
              onClick={() => setActiveTab("streak")}
              className={`py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                activeTab === "streak" ? "bg-[#2D364F] text-white shadow font-black italic" : "text-[#8E9299] hover:text-white"
              }`}
            >
              🔥 Streak Card
            </button>
            <button
              onClick={() => setActiveTab("invite")}
              className={`py-2 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                activeTab === "invite" ? "bg-[#2D364F] text-white shadow font-black italic" : "text-[#8E9299] hover:text-white"
              }`}
            >
              ✉️ Group Invite
            </button>
          </div>
        ) : (
          <h4 className="text-xs font-black italic text-[#8E9299] tracking-wider uppercase">
            {isOnlyStreak ? "🔥 SHARE STREAK CARD" : "✉️ SHARE GROUP INVITE"}
          </h4>
        )}

        <button
          onClick={onClose}
          className="p-2 bg-[#2D364F]/50 hover:bg-[#2D364F] border border-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
          id="share-sheet-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main card stage */}
      <div className="my-auto py-4 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {activeTab === "streak" ? (
            /* 1. Streak Share Card (Portrait 3:4, Ultra-Premium Player Trading Card) */
            <motion.div
              key="streak-card"
              ref={cardRef}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-[290px] xs:max-w-[320px] aspect-[3/4] bg-[#151B2E] border-3 border-[#FF4E00]/40 rounded-[32px] p-4 xs:p-5 relative overflow-hidden shadow-[0_20px_50px_rgba(255,78,0,0.15)] flex flex-col justify-between"
              style={{
                background: "radial-gradient(circle at 50% 35%, rgba(255, 78, 0, 0.18) 0%, rgba(21, 27, 46, 1) 100%)",
              }}
            >
              {/* Decorative top header line and neon particles */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#FF4E00] via-orange-500 to-red-600" />
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#FF4E00]/10 rounded-full filter blur-2xl animate-pulse pointer-events-none" />

              {/* Top Row: Wordmark */}
              <div className="flex justify-between items-center z-10">
                <span className="text-[8px] font-mono font-bold tracking-widest text-[#FF4E00] bg-[#FF4E00]/10 border border-[#FF4E00]/20 px-2 py-0.5 rounded-md uppercase">
                  STREAKR PROOF
                </span>
                <span className="text-xs font-black italic tracking-widest text-white">
                  STREAKR
                </span>
              </div>

              {/* Center Profile Section */}
              <div className="flex flex-col items-center justify-center text-center z-10 py-1 my-auto">
                {/* User Profile Avatar with glowing effect */}
                <div className="relative mb-2.5">
                  <div className="absolute inset-0 bg-[#FF4E00]/20 rounded-full filter blur-md animate-pulse" />
                  <div className="relative bg-[#0A0E1A] border-2 border-white/10 p-2 rounded-2xl flex items-center justify-center shadow-lg">
                    <AvatarRenderer
                      skinTone={avatar.skinTone}
                      kitPrimary={avatar.kitPrimary}
                      kitSecondary={avatar.kitSecondary}
                      expression={avatar.expression}
                      size="md"
                      isAnimated={false}
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black italic text-white tracking-tight">@{avatar.username}</h4>
                  <p className="text-[7px] font-mono text-[#8E9299] uppercase tracking-widest leading-none mt-0.5">
                    WORLD CUP '26 DIVISION
                  </p>
                </div>
              </div>

              {/* Stats Panel (Active streak and Personal Best) */}
              <div className="bg-[#0A0E1A]/80 border border-white/5 rounded-2xl p-2.5 z-10 grid grid-cols-2 gap-2 text-center mb-1">
                <div className="border-r border-white/5 pr-1">
                  <span className="text-[7px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block mb-0.5">
                    Active Streak
                  </span>
                  <span className="text-lg font-black font-mono tracking-tight text-[#FF4E00] block">
                    🔥 {streak}
                  </span>
                </div>
                <div className="pl-1">
                  <span className="text-[7px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block mb-0.5">
                    Personal Best
                  </span>
                  <span className="text-lg font-black font-mono tracking-tight text-amber-400 block">
                    ⚡ {personalBest || streak}
                  </span>
                </div>
              </div>

              {/* Bottom footer stamp */}
              <div className="flex justify-between items-center z-10 pt-2 border-t border-white/5">
                <span className="text-[8px]">
                </span>
                <span className="text-[8px] font-mono text-[#8E9299]">
                  streakr.app/play
                </span>
              </div>
            </motion.div>
          ) : (
            /* 2. Group Invite Post (Portrait 3:4, Squad Room Club Card) */
            <motion.div
              key="invite-card"
              ref={cardRef}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-[290px] xs:max-w-[320px] aspect-[3/4] bg-[#151B2E] border-3 border-[#10B981]/40 rounded-[32px] p-4 xs:p-5 relative overflow-hidden shadow-[0_20px_50px_rgba(16,185,129,0.12)] flex flex-col justify-between"
              style={{
                background: "radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.15) 0%, rgba(21, 27, 46, 1) 100%)",
              }}
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#10B981] to-emerald-500" />
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-500/10 rounded-full filter blur-2xl pointer-events-none" />

              {/* Top Row: Group name */}
              <div className="flex justify-between items-center z-10">
                <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">
                  SQUAD INVITE
                </span>
                <span className="text-xs font-black italic tracking-widest text-white">
                  STREAKR
                </span>
              </div>

              {/* Group Showcase */}
              <div className="flex flex-col items-center justify-center text-center z-10 py-1 my-auto">
                <div className="bg-emerald-500/10 border border-emerald-500/20 w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md mb-1.5 animate-bounce">
                  {groupEmoji}
                </div>
                <div className="px-1 w-full">
                  <span className="text-[7px] font-mono text-[#8E9299] uppercase tracking-widest leading-none block mb-1">
                    SQUAD ROOM INVITATION
                  </span>
                  <h3 className="text-xs font-black italic text-white uppercase tracking-tight break-words max-w-[240px] line-clamp-1">
                    {groupName}
                  </h3>
                </div>
              </div>

              {/* Leaderboard Snapshot */}
              <div className="bg-[#0A0E1A]/80 border border-white/5 rounded-2xl p-2 z-10 space-y-1 mb-1">
                <span className="text-[7px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block text-center mb-0.5">
                  Top Leaderboard
                </span>
                {topMembers.map((m, idx) => (
                  <div key={m.id} className="flex items-center justify-between text-[9px] px-2 py-0.5 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-slate-300 font-bold truncate flex items-center gap-1">
                      <span className="text-[#8E9299] font-mono">#{idx + 1}</span>
                      <span className="truncate">@{m.username}</span>
                    </span>
                    <span className="text-[#FF4E00] font-mono font-black flex items-center gap-0.5">
                      🔥 {m.streak}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Join Code Banner */}
              <div className="flex justify-between items-center z-10 pt-2 border-t border-white/5">
                <div>
                  <span className="text-[7px] font-mono text-[#8E9299] block uppercase leading-none">
                    Invite Code
                  </span>
                  <span className="text-[11px] font-mono font-black text-[#FF4E00] mt-0.5 block italic">
                    {inviteCode}
                  </span>
                </div>
                <div className="bg-[#FF4E00] text-white text-[8px] font-black italic px-2.5 py-1 rounded-lg shadow uppercase tracking-wider">
                  Join Squad
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive download & copy controls */}
      <div className="bg-[#151B2E] border border-white/5 p-4 rounded-3xl max-w-sm w-full mx-auto space-y-3 z-10 flex-shrink-0">
        <h5 className="text-[10px] font-mono font-bold text-[#8E9299] uppercase tracking-widest text-center">
          Shareable Actions
        </h5>

        <div className="flex gap-2.5">
          {/* Save the card as a real PNG */}
          <button
            onClick={handleDownload}
            disabled={busy}
            className="w-1/2 bg-[#0A0E1A] hover:bg-[#2D364F]/50 border border-white/5 text-slate-300 hover:text-white font-black italic text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <Download className="w-4 h-4 text-[#FF4E00]" />
            {busy ? "Saving…" : "Download"}
          </button>

          {/* Copy Direct Invite Link */}
          <button
            onClick={() =>
              handleTriggerCopy(
                shareUrl,
                activeTab === "streak" ? "Streak link copied!" : "Invite link copied!"
              )
            }
            className="w-1/2 bg-[#FF4E00] hover:bg-orange-650 text-white font-black italic text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </button>
        </div>

        {/* Share to X */}
        <button
          onClick={handleShareToX}
          disabled={busy}
          className="w-full bg-black hover:bg-[#111] border border-white/10 text-white font-black italic text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          id="share-to-x"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share to X
        </button>

        {/* Success toast simulation */}
        <AnimatePresence>
          {copiedText && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1.5 rounded-xl text-center flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {copiedText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
