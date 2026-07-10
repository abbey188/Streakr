"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Bell, X, Share, Plus, Check, Sparkles, Smartphone } from "lucide-react";
import {
  pushStatus, enablePush, canInstall, promptInstall, setPushOptedOut,
  type PushState,
} from "@/lib/push/client";

/**
 * The one place we ask for notifications — and for a home-screen install, which
 * we want on BOTH platforms (installed apps get opened far more).
 *
 * Adapts to the platform:
 *   • iOS browser tab → push is impossible until installed; teach the manual add
 *   • Android/desktop → one-tap enable, plus a native "Add to home screen"
 *   • denied / unsupported → say so honestly, don't pretend
 * Never shown when already enabled.
 *
 * Rendered through a portal to <body>: the animated ancestors on Play create
 * stacking contexts that were painting the nav and FAB over this sheet.
 */

/** The whole pitch. Same line on every platform — the card already sold it, so
 *  the modal states it once and gets out of the way. */
const PITCH = "Streakr on your home screen. One tap, and you never miss a pick.";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setError("");
    setState("loading");
    pushStatus().then(setState).catch(() => setState("unsupported"));
  }, [open]);

  const enable = async () => {
    setBusy(true);
    setError("");
    setPushOptedOut(false);
    try {
      const p = await enablePush();
      if (p === "granted") {
        setState("enabled");
        onEnabled?.();
        setTimeout(onClose, 1200); // let them see the confirmation
      } else if (p === "denied") {
        setState("denied");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable alerts.");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") setState(await pushStatus());
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#0A0E1A]/92 backdrop-blur-md z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#151B2E] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-y-auto max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-5 pb-0 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FF4E00]/10 border border-[#FF4E00]/25 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-[#FF4E00]" />
                </div>
                <div>
                  <h3 className="text-base font-black italic text-white uppercase tracking-tight leading-none">
                    Never miss a Streak
                  </h3>
                  <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-wider mt-1">
                    Picks · goals · groups
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 bg-[#0A0E1A] hover:bg-white/5 border border-white/5 rounded-full text-slate-400 hover:text-white transition cursor-pointer flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {state === "loading" && (
                <p className="py-6 text-center text-[11px] font-mono text-[#8E9299] uppercase tracking-widest">Checking…</p>
              )}

              {/* Shared pitch — identical on every platform. Only the mechanics
                  below differ: iOS has no native install prompt, so we teach the
                  manual add. Sell the upgrade; never apologise for the platform. */}
              {(state === "needs-install" || state === "ready") && (
                <p className="text-xs text-slate-300 leading-relaxed">{PITCH}</p>
              )}

              {state === "needs-install" && (
                <>
                  <p className="text-[10px] font-mono text-[#8E9299] uppercase tracking-wider pt-1">
                    Add it in two taps
                  </p>
                  <ol className="space-y-2.5">
                    {[
                      { icon: <Share className="w-3.5 h-3.5" />, text: <>Tap <strong className="text-white">Share</strong> in your browser</> },
                      { icon: <Plus className="w-3.5 h-3.5" />, text: <>Choose <strong className="text-white">Add to Home Screen</strong></> },
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-[#FF4E00] flex-shrink-0">
                          {s.icon}
                        </span>
                        <span className="text-[11px] text-slate-300 leading-relaxed pt-1">{s.text}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[10px] text-[#8E9299] leading-relaxed flex items-start gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#FF4E00] flex-shrink-0 mt-0.5" />
                    Then open Streakr from your home screen and switch alerts on.
                  </p>
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
                      className="w-full bg-[#0A0E1A] hover:bg-white/5 border border-white/10 text-slate-200 font-black italic text-[11px] py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#FF4E00]" />
                      Add to home screen
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
                    This browser doesn&apos;t support alerts yet. Add Streakr to your home
                    screen, or open it in a different browser, to get them.
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
    </AnimatePresence>,
    document.body
  );
}
