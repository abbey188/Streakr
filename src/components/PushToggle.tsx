"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  isPushSupported, isIos, isStandalone, pushPermission, enablePush, disablePush,
} from "@/lib/push/client";

/**
 * Master push-notification opt-in. Handles every state:
 *  - iOS + not installed → "Add to Home Screen" first (iOS only pushes from a PWA)
 *  - unsupported browser → explain
 *  - default → an Enable button (requests permission from this user gesture)
 *  - granted → enabled, with a Turn off option
 *  - denied → tell them to re-enable in browser settings
 * Sits above the per-type toggles in Settings — those refine what's sent once on.
 */
export default function PushToggle() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPerm(pushPermission());
    setNeedsInstall(isIos() && !isStandalone());
  }, []);

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      const p = await enablePush();
      setPerm(p);
      if (p === "denied") setError("You blocked notifications — enable them in your browser settings.");
    } catch (e) {
      // Surface the real reason so failures are diagnosable (esp. on iOS).
      setError(e instanceof Error ? e.message : "Couldn't enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      setPerm("default");
    } finally {
      setBusy(false);
    }
  };

  // iOS Safari tab — push only works once installed to the Home Screen.
  if (needsInstall) {
    return (
      <div className="bg-[#0A0E1A] border border-[#FF4E00]/20 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-[#FF4E00]">
          <Bell className="w-4 h-4" />
          <span className="text-xs font-black italic uppercase tracking-wider text-slate-200">
            Push notifications
          </span>
        </div>
        <p className="text-[10px] text-[#8E9299] leading-relaxed">
          To get alerts on iPhone, add Streakr to your Home Screen first: tap{" "}
          <Share className="inline w-3 h-3 -mt-0.5 text-slate-300" /> <strong className="text-slate-300">Share</strong>{" "}
          → <strong className="text-slate-300">Add to Home Screen</strong>, then open Streakr from your
          home screen and turn notifications on here.
        </p>
      </div>
    );
  }

  const enabled = perm === "granted";

  return (
    <div className="bg-[#0A0E1A] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${enabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-[#151B2E] border-white/5 text-[#FF4E00]"}`}>
          {enabled ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </span>
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-200 block">
            {enabled ? "Push notifications on" : "Push notifications"}
          </span>
          <span className="text-[9px] text-[#8E9299] block mt-0.5 leading-tight">
            {perm === "unsupported"
              ? "Not supported on this browser."
              : perm === "denied"
              ? "Blocked — re-enable in browser settings."
              : enabled
              ? "Goals, results & reminders on this device."
              : "Get alerts even when Streakr is closed."}
          </span>
          {error && <span className="text-[9px] text-red-400 block mt-1 leading-tight">{error}</span>}
        </div>
      </div>

      {perm !== "unsupported" && perm !== "denied" && (
        enabled ? (
          <button
            onClick={disable}
            disabled={busy}
            className="text-[9px] font-mono font-bold text-slate-300 hover:text-white bg-[#2D364F]/50 border border-white/5 px-2.5 py-1.5 rounded-lg transition flex-shrink-0 cursor-pointer disabled:opacity-40"
          >
            {busy ? "…" : "Turn off"}
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="text-[10px] font-black italic text-white bg-[#FF4E00] hover:bg-orange-600 px-3 py-1.5 rounded-lg transition flex-shrink-0 cursor-pointer disabled:opacity-60 shadow"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
        )
      )}
    </div>
  );
}
