"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { track } from "@vercel/analytics";
import { Bell, X, Share, Plus, Check, Sparkles } from "lucide-react";
import {
  pushStatus, enablePush, canInstall, promptInstall, setPushOptedOut,
  type PushState,
} from "@/lib/push/client";

/**
 * The one place we ask for notifications. Adapts to the platform:
 *   • iOS Safari tab  → push is impossible; teach Add to Home Screen
 *   • installed / Android / desktop → one-tap enable
 *   • denied / unsupported → say so honestly, don't pretend
 * Never shown when already enabled.
 */
export default function PushPrompt({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setState("loading");
    pushStatus()
      .then((s) => {
        setState(s);
        // The funnel: which state did people actually land in? iOS install-first
        // is the bottleneck, so we need to see it rather than guess.
        track("push_prompt_shown", { state: s });
      })
      .catch(() => setState("unsupported"));
  }, [open]);

  const enable = async () => {
    setBusy(true);
    setError("");
    setPushOptedOut(false);
    try {
      const p = await enablePush();
      if (p === "granted") {
        setState("enabled");
        track("push_enabled");
        onEnabled?.();
        setTimeout(onClose, 1200); // let them see the confirmation
      } else if (p === "denied") {
        setState("denied");
        track("push_denied");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable alerts.");
      track("push_enable_failed");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    const outcome = await promptInstall();
    track("push_install_prompt", { outcome });
    if (outcome === "accepted") setState(await pushStatus());
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#0A0E1A]/90 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#151B2E] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-5 pb-0 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FF4E00]/10 border border-[#FF4E00]/25 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#FF4E00]" />
                </div>
                <div>
                  <h3 className="text-base font-black italic text-white uppercase tracking-tight leading-none">
                    Never miss a goal
                  </h3>
                  <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-wider mt-1">
                    Goals · results · the crown
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 bg-[#0A0E1A] hover:bg-white/5 border border-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {state === "loading" && (
                <p className="py-6 text-center text-[11px] font-mono text-[#8E9299] uppercase tracking-widest">Checking…</p>
              )}

              {/* iOS: push only exists inside the installed app. Teach the install. */}
              {state === "needs-install" && (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    iPhone only sends alerts from the <strong className="text-white">home-screen app</strong>. Add Streakr — it takes two taps:
                  </p>
                  <ol className="space-y-2.5">
                    {[
                      { icon: <Share className="w-3.5 h-3.5" />, text: <>Tap the <strong className="text-white">Share</strong> button in Safari&apos;s toolbar</> },
                      { icon: <Plus className="w-3.5 h-3.5" />, text: <>Scroll and choose <strong className="text-white">Add to Home Screen</strong></> },
                      { icon: <Sparkles className="w-3.5 h-3.5" />, text: <>Open Streakr from your home screen, then turn alerts on</> },
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-[#FF4E00] flex-shrink-0">
                          {s.icon}
                        </span>
                        <span className="text-[11px] text-slate-300 leading-relaxed pt-1">{s.text}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={onClose}
                    className="w-full bg-[#FF4E00] hover:bg-orange-600 text-white font-black italic text-xs py-3 rounded-2xl transition cursor-pointer shadow"
                  >
                    Got it
                  </button>
                </>
              )}

              {state === "ready" && (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Get pinged the second your team scores, when your pick lands, and when
                    <span className="text-amber-300 font-bold"> The Streakr</span> is crowned — even with the app closed.
                  </p>
                  {error && <p className="text-[10px] text-red-400 leading-snug break-all">⚠ {error}</p>}
                  <button
                    onClick={enable}
                    disabled={busy}
                    className="w-full bg-[#FF4E00] hover:bg-orange-600 text-white font-black italic text-xs py-3.5 rounded-2xl transition cursor-pointer shadow disabled:opacity-60"
                  >
                    {busy ? "Enabling…" : "Enable alerts"}
                  </button>
                  {canInstall() && (
                    <button
                      onClick={install}
                      className="w-full bg-[#0A0E1A] hover:bg-white/5 border border-white/10 text-slate-300 font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-2xl transition cursor-pointer"
                    >
                      Also add to home screen
                    </button>
                  )}
                </>
              )}

              {state === "enabled" && (
                <div className="py-4 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-xs font-black italic text-white">Alerts are on</p>
                  <p className="text-[10px] text-[#8E9299]">We&apos;ll ping you the moment it matters.</p>
                </div>
              )}

              {state === "denied" && (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Notifications are blocked for Streakr. Re-enable them in your browser or
                    device settings, then come back and turn them on here.
                  </p>
                  <button onClick={onClose} className="w-full bg-[#0A0E1A] border border-white/10 text-slate-300 font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-2xl cursor-pointer">
                    Close
                  </button>
                </>
              )}

              {state === "unsupported" && (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This browser doesn&apos;t support push notifications. Try Streakr in Chrome, or add it to your home screen on iPhone.
                  </p>
                  <button onClick={onClose} className="w-full bg-[#0A0E1A] border border-white/10 text-slate-300 font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-2xl cursor-pointer">
                    Close
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
