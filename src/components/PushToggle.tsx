"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  isPushSupported, isIos, isStandalone, pushPermission,
  enablePush, disablePush, subscribeAndSave,
  isPushOptedOut as isOptedOut, setPushOptedOut as setOptedOut,
} from "@/lib/push/client";

type Status = "loading" | "on" | "off" | "denied" | "unsupported";

/**
 * Master push-notification opt-in. "On" reflects an ACTUAL saved subscription,
 * not just the OS permission — so a granted-permission-but-failed-save state
 * shows as off (with the reason), and re-opening Settings self-heals by
 * re-sending any existing subscription to the server.
 */
export default function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setNeedsInstall(isIos() && !isStandalone());
      const perm = pushPermission();
      if (perm === "unsupported") return setStatus("unsupported");
      if (perm === "denied") return setStatus("denied");
      // Respect an explicit turn-off: don't auto-resubscribe just because the OS
      // permission is still granted (permission can't be revoked from code).
      if (perm === "granted" && !isOptedOut()) {
        // Self-heal: re-send the current subscription to the server. Confirms
        // the save actually works and surfaces the failing step if it doesn't.
        try {
          await subscribeAndSave();
          setStatus("on");
        } catch (e) {
          setStatus("off");
          setError(e instanceof Error ? e.message : "sync failed");
        }
        return;
      }
      setStatus("off");
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    setError("");
    setOptedOut(false); // clear any prior opt-out
    try {
      const p = await enablePush();
      if (p === "granted") setStatus("on");
      else if (p === "denied") { setStatus("denied"); }
      else setStatus("off");
    } catch (e) {
      setStatus("off");
      setError(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setOptedOut(true); // remember the choice so open-app self-heal doesn't re-enable
    try {
      await disablePush();
      setStatus("off");
      setError("");
    } finally {
      setBusy(false);
    }
  };

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

  const on = status === "on";
  const subtitle =
    status === "unsupported" ? "Not supported on this browser."
    : status === "denied" ? "Blocked — re-enable in browser settings."
    : status === "loading" ? "Checking…"
    : on ? "Goals, results & reminders on this device."
    : "Get alerts even when Streakr is closed.";

  return (
    <div className="bg-[#0A0E1A] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${on ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-[#151B2E] border-white/5 text-[#FF4E00]"}`}>
          {on ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </span>
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-200 block">
            {on ? "Push notifications on" : "Push notifications"}
          </span>
          <span className="text-[9px] text-[#8E9299] block mt-0.5 leading-tight">{subtitle}</span>
          {error && <span className="text-[9px] text-red-400 block mt-1 leading-tight break-all">⚠ {error}</span>}
        </div>
      </div>

      {status !== "unsupported" && status !== "denied" && status !== "loading" && (
        on ? (
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
            {busy ? "Enabling…" : error ? "Retry" : "Enable"}
          </button>
        )
      )}
    </div>
  );
}
