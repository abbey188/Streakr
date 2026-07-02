import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Flame, Sparkles } from "lucide-react";

interface ScreenLandingProps {
  onTimeout: () => void;
  onSkipToHome?: () => void;
}

export default function ScreenLanding({ onTimeout, onSkipToHome }: ScreenLandingProps) {
  const [progress, setProgress] = useState(0);

  // Auto-progress timeline to transition to auth
  useEffect(() => {
    const duration = 2000; // 2 seconds flat, then auto-advance
    const intervalTime = 30;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    // Timeout to trigger the callback
    const redirectTimer = setTimeout(() => {
      onTimeout();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [onTimeout]);

  return (
    <div
      className="relative w-full h-full min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* 1. Signature Orange & Charcoal Diagonal Streaks Background Pattern */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-95">
        {/* Dynamic sliding gradient orange streaks (slashed style) */}
        <motion.div
          initial={{ x: "-100%", y: "100%" }}
          animate={{ x: "0%", y: "0%" }}
          transition={{ type: "spring", stiffness: 40, damping: 12, delay: 0.1 }}
          className="absolute top-[-20%] left-[-20%] w-[150%] h-[60%] bg-[#FF4E00] origin-bottom-left rotate-[-25deg] shadow-[0_0_80px_rgba(255,78,0,0.6)]"
        />

        {/* Second black offset streak cutting through to make the layout sharp & high-contrast */}
        <motion.div
          initial={{ x: "100%", y: "-100%" }}
          animate={{ x: "0%", y: "0%" }}
          transition={{ type: "spring", stiffness: 35, damping: 14, delay: 0.2 }}
          className="absolute top-[35%] left-[-10%] w-[160%] h-[20%] bg-black origin-top-right rotate-[-25deg] border-y-8 border-[#FF4E00]"
        />

        {/* Dynamic secondary accent orange streak */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.4 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
          className="absolute bottom-[10%] left-[-10%] w-[140%] h-[12%] bg-[#FF4E00]/40 origin-left rotate-[-25deg] blur-sm"
        />

        {/* Grid pattern overlay for high-tech premium gaming look */}
        <div 
          className="absolute inset-0 opacity-[0.15]" 
          style={{
            backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />
      </div>

      {/* 2. Main Logo Container */}
      <div className="z-10 flex flex-col items-center text-center px-6 max-w-lg w-full">
        {/* White Rounded Badge with Vibrant Red/Orange Flame Inside */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.3 }}
          className="w-22 h-22 sm:w-24 sm:h-24 bg-white rounded-[28px] border-4 border-black flex items-center justify-center shadow-[6px_6px_0px_#000000,0_20px_40px_rgba(255,78,0,0.3)] mb-6 group relative"
        >
          {/* Inner Red Flame badge backdrop */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 bg-[#FF4E00] rounded-[20px] flex items-center justify-center">
            <Flame className="w-10 h-10 sm:w-11 sm:h-11 text-white fill-white animate-pulse" />
          </div>

          {/* Sparkle badge decorator */}
          <span className="absolute -top-2 -right-2 bg-yellow-400 text-black border-2 border-black p-1 rounded-xl shadow-md">
            <Sparkles className="w-4 h-4 fill-current" />
          </span>
        </motion.div>

        {/* Brand Typography with Offset 3D Block Shadow (Brutalist style matching REMIX mockup) */}
        <div className="relative mb-3">
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.5 }}
            className="text-6xl sm:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter text-white select-none filter drop-shadow-[5px_5px_0px_#000000] border-black"
            style={{
              WebkitTextStroke: "2px #000000",
            }}
          >
            STREAKR
          </motion.h1>
          
          {/* Absolute duplicate underlay for perfect 3D offset contrast */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.52 }}
            className="absolute inset-0 text-6xl sm:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter text-black select-none -z-10 translate-x-[6px] translate-y-[6px]"
          >
            STREAKR
          </motion.div>
        </div>

        {/* High-Octane Brand Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-xs sm:text-sm font-mono font-black uppercase tracking-[0.12em] text-white bg-black/80 border border-white/10 px-4 py-1.5 rounded-full shadow-lg text-center"
        >
          MAKE YOUR PICK TO WIN AND BUILD YOUR STREAK.
        </motion.p>
      </div>

      {/* 3. Bottom Loading Progress indicator & Prompt */}
      <div className="absolute bottom-12 inset-x-6 z-10 flex flex-col items-center max-w-xs mx-auto space-y-4">
        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-black/55 border border-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-400 to-[#FF4E00] shadow-[0_0_10px_#FF4E00]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
