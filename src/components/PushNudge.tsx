"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { pushStatus, isPushOptedOut, type PushState } from "@/lib/push/client";
import PushPrompt from "./PushPrompt";

const DISMISS_KEY = "streakr_push_nudge_dismissed";

/**
 * A gentle, dismissible invitation to turn on alerts. Renders NOTHING when push
 * is already on, blocked, unsupported, explicitly opted out, or dismissed — so
 * it never nags. Shared by Play and the Inbox; dismissing hides it everywhere.
 */
export default function PushNudge() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [dismissed, setDismissed] = useState(true); // assume hidden until we know
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1" || isPushOptedOut()); }
    catch { setDismissed(false); }
    pushStatus().then(setState).catch(() => setState("unsupported"));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* no storage */ }
  };

  // Only actionable states are worth an invitation.
  const actionable = state === "ready" || state === "needs-install";
  if (dismissed || !actionable) {
    // Still mount the prompt so an "enabled" transition can close cleanly.
    return promptOpen ? <PushPrompt open onClose={() => setPromptOpen(false)} /> : null;
  }

  return (
    <>
      <div className="bg-[#151B2E] border border-[#FF4E00]/20 rounded-3xl p-4 flex items-center gap-3 relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-[#FF4E00]/5 rounded-l-full blur-xl pointer-events-none" />
        <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] border border-[#FF4E00]/20 flex items-center justify-center flex-shrink-0 z-10">
          <Bell className="w-4.5 h-4.5 text-[#FF4E00]" />
        </div>
        {/* One message on every platform: Streakr on your home screen is simply
            the better way to play. The install/enable mechanics differ inside
            the modal; the promise does not. */}
        <div className="flex-grow min-w-0 z-10">
          <p className="text-xs font-black text-white leading-tight">Never miss a Streak</p>
          <p className="text-[10px] text-[#A2A7AF] leading-snug mt-0.5">
            Pick reminders, live goals and group alerts — Streakr, one tap from your home screen.
          </p>
        </div>
        <button
          onClick={() => setPromptOpen(true)}
          className="z-10 flex-shrink-0 bg-[#FF4E00] hover:bg-orange-600 text-white font-black text-[10px] px-3 py-2 rounded-xl transition cursor-pointer shadow"
        >
          Add it
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="z-10 flex-shrink-0 p-1 text-[#A2A7AF]/60 hover:text-white transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <PushPrompt
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        onEnabled={() => { setState("enabled"); dismiss(); }}
      />
    </>
  );
}
