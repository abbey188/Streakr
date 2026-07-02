import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, User, ArrowRight, X, Award, Trophy, Tv, Users, Bell } from "lucide-react";

// A sleek, minimalist custom vector soccer ball icon
const BallIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m12 8-3.5 2.5 1.5 4h4l1.5-4Z" />
    <path d="M12 8V2" />
    <path d="m8.5 10.5-5.5-2" />
    <path d="m15.5 10.5 5.5-2" />
    <path d="m10 14.5-3 5.5" />
    <path d="m14 14.5 3 5.5" />
  </svg>
);

interface ScreenTourProps {
  onDismiss: () => void;
}

export default function ScreenTour({ onDismiss }: ScreenTourProps) {
  const [step, setStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const [highlightRect, setHighlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    found: boolean;
  } | null>(null);

  // A whole-app walkthrough, all from the Play page — each step spotlights a real
  // element. `selectorMobile` is used below the lg breakpoint (bottom nav / FAB);
  // otherwise the desktop `selector` (sidebar / widget) is used.
  const steps: {
    id: number;
    title: string;
    text: string;
    selector: string;
    selectorMobile?: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }[] = [
    {
      id: 1,
      title: "Your Streak",
      text: "This is your live streak — consecutive correct picks. Each correct pick adds 1; a single wrong pick resets it to 0. The longer it runs, the higher you climb.",
      selector: "#hud-streak-flame",
      icon: Flame,
    },
    {
      id: 2,
      title: "Your Points",
      text: "Points are permanent — you bank 10 × your streak length on every correct pick and never lose them. They set your global level, even after a streak breaks.",
      selector: "#hud-points",
      icon: Award,
    },
    {
      id: 3,
      title: "Make a Pick",
      text: "Knockouts have no draws! Tap any fixture and pick who advances — extra time and penalties count. This is where you build your streak.",
      selector: '[id^="home-tap-pick-"]',
      icon: BallIcon,
    },
    {
      id: 4,
      title: "Global Leaderboard",
      text: "See how you stack up against the whole world — ranked by active streak or by lifetime points. Search anyone and find your rank.",
      selector: "#global-leaderboard-widget",
      selectorMobile: "#mobile-globe-button",
      icon: Trophy,
    },
    {
      id: 5,
      title: "The Hub",
      text: "Live scores, minute-by-minute timelines, stats, possession and lineups for every match — follow the games as they happen.",
      selector: "#nav-pc-hub",
      selectorMobile: "#nav-mobile-hub",
      icon: Tv,
    },
    {
      id: 6,
      title: "Groups",
      text: "Create or join a squad and battle your friends on a private leaderboard. Winning a round crowns a Group Champion.",
      selector: "#nav-pc-groups",
      selectorMobile: "#nav-mobile-groups",
      icon: Users,
    },
    {
      id: 7,
      title: "Inbox",
      text: "Everything addressed to you: pick results, goals in your matches, badges you unlock, round-champion crowns and milestones from your groups.",
      selector: "#nav-pc-inbox",
      selectorMobile: "#nav-mobile-inbox",
      icon: Bell,
    },
    {
      id: 8,
      title: "Your Profile",
      text: "Customize your mascot, show off your badges, and fine-tune exactly which notifications you get. Your identity across every leaderboard.",
      selector: "#nav-pc-profile",
      selectorMobile: "#nav-mobile-profile",
      icon: User,
    },
  ];

  const currentStep = steps[step - 1];

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    
    // Initial measurement
    const rect = containerRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });

    return () => resizeObserver.disconnect();
  }, []);

  // Update target element highlight coordinates
  useEffect(() => {
    const updateHighlight = () => {
      if (!containerRef.current) return;
      const isMobile = window.innerWidth < 1024; // lg breakpoint (sidebar appears)
      const selector = isMobile ? currentStep.selectorMobile ?? currentStep.selector : currentStep.selector;
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Ensure some minimum visible dimensions if element is too small or collapsed
        const w = Math.max(rect.width, 40);
        const h = Math.max(rect.height, 40);
        
        setHighlightRect({
          top: rect.top - containerRect.top,
          left: rect.left - containerRect.left,
          width: w,
          height: h,
          found: true,
        });
      } else {
        // Fallback to center of the workspace if element is absent
        setHighlightRect(null);
      }
    };

    updateHighlight();
    
    // Double-check with a slight delay to ensure dynamic lazy elements have loaded
    const timer1 = setTimeout(updateHighlight, 150);
    const timer2 = setTimeout(updateHighlight, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [step, dimensions]);

  // Bring each step's target into view (nav items are fixed and won't move; the
  // leaderboard widget may sit below the fold on shorter screens).
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    const selector = isMobile ? currentStep.selectorMobile ?? currentStep.selector : currentStep.selector;
    document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      onDismiss();
    }
  };

  // Calculate dynamic position for the floating tooltip coachmark
  const getTooltipStyle = () => {
    if (!highlightRect || !highlightRect.found) {
      // Centered fallback
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "absolute" as const,
        width: "min(360px, 92vw)",
      };
    }

    const { top, left, width, height } = highlightRect;
    const isMobile = dimensions.width < 1024; // sidebar appears at lg

    if (isMobile) {
      // Place the card in the middle of the screen vertically on mobile
      // This guarantees it is in the safe zone and never overlaps with bottom action controls or the Skip button
      return {
        top: "45%",
        left: "12px",
        right: "12px",
        transform: "translateY(-50%)",
        position: "absolute" as const,
        width: "calc(100% - 24px)",
      };
    }

    // Desktop: Intelligent positioning based on highlight coordinates
    const tooltipWidth = 350;
    const tooltipHeight = 180; // Compact height
    
    let x = left + width / 2 - tooltipWidth / 2;
    let y = top + height + 16; // Default: show below the highlight

    // If showing below would overflow bottom, or if highlight is in the lower half, show above
    const spaceBelow = dimensions.height - (top + height);
    const spaceAbove = top;
    
    if (y + tooltipHeight > dimensions.height - 16 && spaceAbove > spaceBelow) {
      y = top - tooltipHeight - 16; // Show above
    }

    // Bounds check horizontal overflow
    if (x < 16) x = 16;
    if (x + tooltipWidth > dimensions.width - 16) {
      x = dimensions.width - tooltipWidth - 16;
    }

    return {
      top: `${y}px`,
      left: `${x}px`,
      position: "absolute" as const,
      width: `${tooltipWidth}px`,
    };
  };

  const StepIcon = currentStep.icon;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70] overflow-hidden select-none"
      style={{ pointerEvents: "auto" }}
    >
      {/* 1. Vector Spotlight Cutout Overlay (Dynamic Mask) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 transition-all duration-300">
        <defs>
          <mask id="spotlight-cutout-mask">
            {/* White covers everything (blocks transparency) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight hole */}
            {highlightRect ? (
              <rect
                x={highlightRect.left - 10}
                y={highlightRect.top - 10}
                width={highlightRect.width + 20}
                height={highlightRect.height + 20}
                rx="18"
                fill="black"
              />
            ) : (
              // Invisible tiny circle offscreen if no highlight is active
              <circle cx="-100" cy="-100" r="1" fill="black" />
            )}
          </mask>
        </defs>

        {/* Semi-transparent dark ambient backing mask with glass blur effect */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(10, 14, 26, 0.65)"
          className="backdrop-blur-[2px]"
          mask="url(#spotlight-cutout-mask)"
        />
      </svg>

      {/* 2. Floating Animated Neon Target Frame */}
      {highlightRect && (
        <motion.div
          initial={false}
          animate={{
            top: highlightRect.top - 10,
            left: highlightRect.left - 10,
            width: highlightRect.width + 20,
            height: highlightRect.height + 20,
            opacity: 1,
          }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="absolute border-2 border-dashed border-[#FF4E00] rounded-[18px] pointer-events-none z-45 flex items-center justify-center"
        >
          {/* Subtle flashing outer shadow glow */}
          <div className="absolute inset-0 rounded-[16px] bg-[#FF4E00]/5 shadow-[0_0_25px_rgba(255,78,0,0.5)] animate-pulse" />
          
          {/* Animated beacon element */}
          <span className="absolute flex h-3.5 w-3.5 -top-1.5 -right-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4E00] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF4E00]"></span>
          </span>
        </motion.div>
      )}

      {/* 3. Top Navigation Status Header removed */}

      {/* 4. Elegant Dynamic Tooltip Coachmark */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -15 }}
          transition={{ duration: 0.22 }}
          style={getTooltipStyle()}
          className="z-50 bg-[#151B2E] border border-white/10 rounded-[20px] p-4.5 sm:p-5 lg:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden"
        >
          {/* Top accent visual strip */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FF4E00] to-indigo-500" />

          <div className="space-y-3 lg:space-y-4">
            {/* Header with Step Tracker */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 lg:p-1.5 bg-white/5 rounded-lg border border-white/5">
                  <StepIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[#FF4E00]" />
                </div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">
                  {currentStep.title}
                </h3>
              </div>
              <span className="text-[9px] lg:text-[10px] font-mono font-black text-[#8E9299] bg-[#0A0E1A] px-2 py-0.5 lg:px-2.5 lg:py-1 rounded border border-white/5">
                {step} / {steps.length}
              </span>
            </div>

            {/* Description Text */}
            <p className="text-xs lg:text-[13px] text-slate-300 leading-relaxed font-medium">
              {currentStep.text}
            </p>

            {/* Actions Row */}
            <div className="flex items-center justify-between pt-3 lg:pt-4 border-t border-white/5">
              {/* Animated Progress Indicators */}
              <div className="flex gap-1.5">
                {steps.map((s, idx) => (
                  <span
                    key={s.id}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      step === idx + 1 ? "bg-[#FF4E00] w-5" : "bg-[#2D364F] w-1.5"
                    }`}
                  />
                ))}
              </div>

              {/* Action Trigger */}
              <button
                onClick={handleNext}
                className="bg-[#FF4E00] hover:bg-orange-600 text-white text-[11px] lg:text-xs font-black italic px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#FF4E00]/15 transition cursor-pointer"
              >
                {step === steps.length ? "Let's Play!" : "Next Tip"}
                <ArrowRight className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 5. Floating Skip Tour Button at Bottom-Right */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8 z-50">
        <button
          onClick={onDismiss}
          className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8E9299] hover:text-white flex items-center gap-1.5 py-2 px-4 bg-[#2D364F]/70 border border-white/5 rounded-full transition cursor-pointer shadow-lg hover:bg-[#2D364F]"
        >
          Skip Tour <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
