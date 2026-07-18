"use client";

import { Flame } from "lucide-react";
import { motion } from "motion/react";

/**
 * The single universal "working" state — shown during session restore, wallet
 * provisioning, and profile/data loads. Kept consistent everywhere. Pass a
 * `label` for a context-specific message (e.g. onboarding's "Locking in…").
 */
export default function LoadingSplash({ label = "Loading your streak…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-5 bg-[#0A0E1A] text-white">
      <motion.div
        initial={{ scale: 0.9, opacity: 0.6 }}
        animate={{ scale: [0.9, 1, 0.9], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="w-14 h-14 bg-[#FF4E00] rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(255,78,0,0.5)]"
      >
        <Flame className="w-8 h-8 text-white fill-white" />
      </motion.div>
      <span className="text-[10px] font-mono text-[#A2A7AF] font-bold uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}
