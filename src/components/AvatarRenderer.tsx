import React from "react";
import { motion, type Variants } from "motion/react";

interface AvatarRendererProps {
  skinTone: string;
  kitPrimary: string;
  kitSecondary: string;
  expression: string;
  jerseyNumber?: string;
  headgear?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isAnimated?: boolean;
  upperBodyOnly?: boolean;
}

export const EXPRESSIONS_MAP: { [key: string]: { label: string; render: () => React.JSX.Element } } = {
  happy: {
    label: "Happy",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Happy arches for eyes */}
        <path d="M 12 18 Q 16 14 20 18" />
        <path d="M 30 18 Q 34 14 38 18" />
        {/* Smile */}
        <path d="M 18 27 Q 25 33 32 27" strokeWidth="3" />
      </g>
    ),
  },
  hyped: {
    label: "Hyped",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Big circular eyes */}
        <circle cx="16" cy="18" r="4.5" fill="currentColor" />
        <circle cx="34" cy="18" r="4.5" fill="currentColor" />
        {/* Shouting mouth */}
        <ellipse cx="25" cy="30" rx="4" ry="6.5" fill="#EF4444" strokeWidth="2.5" />
      </g>
    ),
  },
  cool: {
    label: "Cool",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Lens */}
        <rect x="10" y="14" width="12" height="8" rx="2.5" fill="currentColor" stroke="none" />
        {/* Right Lens */}
        <rect x="28" y="14" width="12" height="8" rx="2.5" fill="currentColor" stroke="none" />
        {/* Bridge */}
        <line x1="22" y1="18" x2="28" y2="18" strokeWidth="3" />
        {/* Cool straight smirk */}
        <path d="M 18 28 L 30 27" fill="none" strokeWidth="3" />
      </g>
    ),
  },
  smug: {
    label: "Smug",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Slanted sleepy/smug eyes */}
        <path d="M 11 19 L 21 16 M 12 20 L 20 20" />
        <path d="M 39 19 L 29 16 M 38 20 L 30 20" strokeWidth="2.5" />
        {/* Sidelong smirk */}
        <path d="M 22 28 Q 28 30 33 25" strokeWidth="3" />
      </g>
    ),
  },
  chill: {
    label: "Chill",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Relaxed straight/curved eyes */}
        <line x1="12" y1="18" x2="20" y2="18" />
        <line x1="30" y1="18" x2="38" y2="18" />
        {/* Gentle line smile */}
        <path d="M 20 27 L 30 27" strokeWidth="2.5" />
      </g>
    ),
  },
  wink: {
    label: "Wink",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Left eye open, right eye closed wink */}
        <circle cx="16" cy="18" r="3.5" fill="currentColor" />
        <path d="M 30 18 Q 34 14 38 18" strokeWidth="3" />
        {/* Happy smile */}
        <path d="M 18 26 Q 25 32 32 26" strokeWidth="3" />
      </g>
    ),
  },
  sly: {
    label: "Sly",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Sly diagonal eyebrows + low eyes */}
        <path d="M 10 13 L 20 16" strokeWidth="2" />
        <path d="M 40 13 L 30 11" strokeWidth="2" />
        <circle cx="16" cy="19" r="2.5" fill="currentColor" />
        <circle cx="34" cy="19" r="2.5" fill="currentColor" />
        {/* Uneven grin */}
        <path d="M 17 28 Q 23 25 31 29" strokeWidth="3" />
      </g>
    ),
  },
  determined: {
    label: "Determined",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Angled angry brows */}
        <path d="M 10 14 L 20 18" strokeWidth="3" />
        <path d="M 40 14 L 30 18" strokeWidth="3" />
        <circle cx="16" cy="21" r="2.5" fill="currentColor" />
        <circle cx="34" cy="21" r="2.5" fill="currentColor" />
        {/* Flat mouth */}
        <line x1="18" y1="28" x2="32" y2="28" strokeWidth="3" />
      </g>
    ),
  },
  sleepy: {
    label: "Sleepy",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Sleepy curved down eyes */}
        <path d="M 12 18 Q 16 22 20 18" strokeWidth="3" />
        <path d="M 30 18 Q 34 22 38 18" strokeWidth="3" />
        {/* Little yawny circle mouth */}
        <circle cx="25" cy="28" r="3.5" fill="none" strokeWidth="2.5" />
      </g>
    ),
  },
  starstruck: {
    label: "Starstruck",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Star symbols for eyes */}
        <path d="M 16 11 L 18 15 L 22 15 L 19 18 L 20 22 L 16 20 L 12 22 L 13 18 L 10 15 L 14 15 Z" fill="#EAB308" stroke="#EAB308" strokeWidth="1" />
        <path d="M 34 11 L 36 15 L 40 15 L 37 18 L 38 22 L 34 20 L 30 22 L 31 18 L 28 15 L 32 15 Z" fill="#EAB308" stroke="#EAB308" strokeWidth="1" />
        {/* Open wide grin */}
        <path d="M 17 26 Q 25 34 33 26 Z" fill="currentColor" />
      </g>
    ),
  },
  "big grin": {
    label: "Big Grin",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Arched laughing eyes */}
        <path d="M 12 18 Q 16 14 20 18" strokeWidth="3" />
        <path d="M 30 18 Q 34 14 38 18" strokeWidth="3" />
        {/* Toothy laughing open mouth */}
        <path d="M 15 25 Q 25 35 35 25 Z" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.5" />
        <line x1="16" y1="25" x2="34" y2="25" strokeWidth="2" />
      </g>
    ),
  },
  cheeky: {
    label: "Cheeky",
    render: () => (
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* One normal eye, one happy arch wink */}
        <circle cx="16" cy="18" r="3.5" fill="currentColor" />
        <path d="M 30 18 Q 34 14 38 18" strokeWidth="3" />
        {/* Smile with a cute pink tongue sticking out */}
        <path d="M 18 26 Q 25 30 32 26" strokeWidth="3" />
        <path d="M 23 27 Q 25 34 27 27 Z" fill="#EC4899" stroke="#EC4899" strokeWidth="1" />
      </g>
    ),
  },
};

export const SKIN_TONES = [
  { id: "tone1", color: "#FEE2E2", label: "Warm White", outline: "#312E81" },
  { id: "tone2", color: "#FFEDD5", label: "Soft Cream", outline: "#2E1065" },
  { id: "tone3", color: "#FCD34D", label: "Golden Honey", outline: "#1E1B4B" },
  { id: "tone4", color: "#D97706", label: "Warm Bronze", outline: "#E3C7CC" },
  { id: "tone5", color: "#92400E", label: "Rich Cocoa", outline: "#FEF08A" },
  { id: "tone6", color: "#451A03", label: "Dark Obsidian", outline: "#C9C4D6" },
];

export const KITS = [
  { id: "kit1", primary: "#2563EB", secondary: "#FACC15", label: "Blue / Gold (Brazil vibe)", name: "Ipanema Blue" },
  { id: "kit2", primary: "#EF4444", secondary: "#FFFFFF", label: "Crimson / White (Eng/Sui)", name: "Red Devils" },
  { id: "kit3", primary: "#FACC15", secondary: "#16A34A", label: "Yellow / Green (Jamaica/Aus)", name: "Verde Amarela" },
  { id: "kit4", primary: "#10B981", secondary: "#FFFFFF", label: "Emerald / White (Nig/Mex)", name: "Super Green" },
  { id: "kit5", primary: "#0EA5E9", secondary: "#FFFFFF", label: "Sky / White Stripe (Arg)", name: "La Celeste" },
  { id: "kit6", primary: "#F97316", secondary: "#1E293B", label: "Orange / Black (Ned/Syr)", name: "Oranje" },
  { id: "kit7", primary: "#1E293B", secondary: "#F59E0B", label: "Coal Black / Gold (Bel/Ger)", name: "Coal & Gold" },
  { id: "kit8", primary: "#84CC16", secondary: "#A855F7", label: "Neon Lime / Purple (Remix style)", name: "Glitch Neon" },
];

export default function AvatarRenderer({
  skinTone,
  kitPrimary,
  kitSecondary,
  expression,
  jerseyNumber,
  headgear,
  size = "md",
  className = "",
  isAnimated = false,
  upperBodyOnly = false,
}: AvatarRendererProps) {
  // Determine pixel size boundaries
  const scale =
    size === "sm" ? 0.6 : size === "md" ? 1.0 : size === "lg" ? 1.5 : size === "xl" ? 2.2 : 1.0;
  const pixelWidth = 100 * scale;
  const pixelHeight = (upperBodyOnly ? 92 : 120) * scale;

  // Find outline ink color adjusted for dark skin tones
  const matchedTone = SKIN_TONES.find((t) => t.color.toLowerCase() === skinTone.toLowerCase()) || SKIN_TONES[1];
  const inkColor = matchedTone.outline;

  const renderFace = EXPRESSIONS_MAP[expression]?.render || EXPRESSIONS_MAP["happy"].render;

  // Animation values using framer-motion variants. The `: Variants` annotations
  // are load-bearing: without them TS widens `ease: "easeInOut"` to `string`,
  // which isn't a valid Easing, and every `variants={...}` below fails to
  // typecheck. Annotating types `ease` contextually — no values change.
  const containerVariants: Variants = {
    breathe: {
      y: [0, -3, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    static: { y: 0 },
  };

  const headVariants: Variants = {
    breathe: {
      y: [0, -1.5, 0],
      rotate: [0, 1, -1, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    static: { y: 0, rotate: 0 },
  };

  const armLeftVariants: Variants = {
    breathe: {
      rotate: [0, 8, 0],
      originX: 1,
      originY: 0.2,
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    static: { rotate: 0 },
  };

  const armRightVariants: Variants = {
    breathe: {
      rotate: [0, -8, 0],
      originX: 0,
      originY: 0.2,
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    static: { rotate: 0 },
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: pixelWidth, height: pixelHeight }}
    >
      {/* Background shadow disk */}
      {!upperBodyOnly && (
        <div
          className="absolute bottom-0 bg-black/15 rounded-full filter blur-[2px] transition-all"
          style={{
            width: pixelWidth * 0.75,
            height: pixelHeight * 0.1,
            left: `${pixelWidth * 0.125}px`,
          }}
        />
      )}

      <motion.svg
        viewBox={upperBodyOnly ? "0 0 100 92" : "0 0 100 120"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative"
        animate={isAnimated ? "breathe" : "static"}
        variants={containerVariants}
      >
        {/* Left Arm */}
        <motion.rect
          x="10"
          y="62"
          width="12"
          height="24"
          rx="4"
          fill={kitPrimary}
          stroke={inkColor}
          strokeWidth="3"
          variants={armLeftVariants}
        />
        {/* Left Arm hand cap (Skin tone) */}
        <motion.rect
          x="10"
          y="80"
          width="12"
          height="8"
          rx="3"
          fill={skinTone}
          stroke={inkColor}
          strokeWidth="3"
          variants={armLeftVariants}
        />

        {/* Right Arm */}
        <motion.rect
          x="78"
          y="62"
          width="12"
          height="24"
          rx="4"
          fill={kitPrimary}
          stroke={inkColor}
          strokeWidth="3"
          variants={armRightVariants}
        />
        {/* Right Arm hand cap (Skin tone) */}
        <motion.rect
          x="78"
          y="80"
          width="12"
          height="8"
          rx="3"
          fill={skinTone}
          stroke={inkColor}
          strokeWidth="3"
          variants={armRightVariants}
        />

        {/* Left Foot */}
        {!upperBodyOnly && (
          <rect
            x="28"
            y="102"
            width="16"
            height="14"
            rx="4"
            fill="#1E293B"
            stroke={inkColor}
            strokeWidth="3"
          />
        )}

        {/* Right Foot */}
        {!upperBodyOnly && (
          <rect
            x="56"
            y="102"
            width="16"
            height="14"
            rx="4"
            fill="#1E293B"
            stroke={inkColor}
            strokeWidth="3"
          />
        )}

        {/* Torso / Jersey */}
        <rect
          x="20"
          y="56"
          width="60"
          height="48"
          rx="8"
          fill={kitPrimary}
          stroke={inkColor}
          strokeWidth="3"
        />

        {/* Torso Jersey Accent Stripes */}
        {/* Stripe 1 (diagonal or vertical) */}
        <rect
          x="36"
          y="57.5"
          width="8"
          height="45"
          fill={kitSecondary}
        />
        <rect
          x="56"
          y="57.5"
          width="8"
          height="45"
          fill={kitSecondary}
        />

        {/* Jersey Number overlay — number takes the KIT PRIMARY colour with a
            secondary/white trim, so on white-striped kits it never reads as a
            flat white blob against the white stripes. */}
        {jerseyNumber !== "none" && (
          <text
            x="50"
            y="85"
            textAnchor="middle"
            fill={kitPrimary}
            stroke={kitSecondary}
            strokeWidth="3"
            paintOrder="stroke"
            fontSize="18"
            fontWeight="900"
            fontFamily="'Space Grotesk', 'Inter', sans-serif"
            className="select-none font-black"
          >
            {jerseyNumber || "10"}
          </text>
        )}

        {/* Neck connector */}
        <rect
          x="44"
          y="48"
          width="12"
          height="10"
          fill={skinTone}
          stroke={inkColor}
          strokeWidth="3"
        />

        {/* Head Block */}
        <motion.g variants={headVariants}>
          {/* Head Shape */}
          <rect
            x="24"
            y="10"
            width="52"
            height="44"
            rx="10"
            fill={skinTone}
            stroke={inkColor}
            strokeWidth="3.5"
          />

          {/* Blocky Mascot Cat/Remix Ears */}
          {/* Left Ear */}
          <path
            d="M 28 11 L 28 2 L 38 10 Z"
            fill={skinTone}
            stroke={inkColor}
            strokeWidth="3"
            strokeLinejoin="miter"
          />
          {/* Right Ear */}
          <path
            d="M 72 11 L 72 2 L 62 10 Z"
            fill={skinTone}
            stroke={inkColor}
            strokeWidth="3"
            strokeLinejoin="miter"
          />

          {/* Custom Headgear */}
          {headgear === "cap" && (
            <g>
              {/* Cap dome */}
              <path
                d="M 23.5 22 C 23.5 10, 76.5 10, 76.5 22 Z"
                fill={kitPrimary}
                stroke={inkColor}
                strokeWidth="3"
              />
              {/* Visor / Brim */}
              <path
                d="M 14 20 L 86 20 L 82 24 L 18 24 Z"
                fill={kitSecondary}
                stroke={inkColor}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Button on top */}
              <circle cx="50" cy="11" r="3" fill={kitSecondary} stroke={inkColor} strokeWidth="2" />
              {/* Little detail/badge on the cap */}
              <circle cx="50" cy="17" r="2.5" fill="#FFFFFF" />
            </g>
          )}

          {headgear === "crown" && (
            <g>
              {/* Crown resting further down on the head to avoid clipping */}
              <path
                d="M 24 18 L 28 10 L 37 14 L 50 8 L 63 14 L 72 10 L 76 18 Z"
                fill="#FACC15"
                stroke={inkColor}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Gems */}
              <circle cx="28" cy="10" r="2.5" fill="#EF4444" stroke={inkColor} strokeWidth="1" />
              <circle cx="50" cy="8" r="2.5" fill="#3B82F6" stroke={inkColor} strokeWidth="1" />
              <circle cx="72" cy="10" r="2.5" fill="#10B981" stroke={inkColor} strokeWidth="1" />
              <circle cx="50" cy="14" r="2.5" fill="#EC4899" stroke={inkColor} strokeWidth="1" />
            </g>
          )}

          {headgear === "bandana" && (
            <g>
              {/* Bandana tie on left side */}
              <path d="M 22 18 L 10 14 L 14 24 Z" fill="#EF4444" stroke={inkColor} strokeWidth="2.5" />
              <path d="M 22 20 L 8 22 L 12 28 Z" fill="#EF4444" stroke={inkColor} strokeWidth="2.5" />
              {/* Bandana strip across head */}
              <rect
                x="23.5"
                y="14"
                width="53"
                height="8"
                fill="#EF4444"
                stroke={inkColor}
                strokeWidth="3"
              />
              {/* Swoosh accent on bandana */}
              <path
                d="M 47 18 L 49 20 L 53 16"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          )}

          {headgear === "beanie" && (
            <g>
              {/* Beanie Pom-pom on top */}
              <circle
                cx="50"
                cy="5"
                r="4.5"
                fill={kitSecondary}
                stroke={inkColor}
                strokeWidth="2.5"
              />
              {/* Beanie main dome */}
              <path
                d="M 24 14 C 24 6, 76 6, 76 14 Z"
                fill={kitPrimary}
                stroke={inkColor}
                strokeWidth="3"
              />
              {/* Beanie folded cuff */}
              <rect
                x="22"
                y="11"
                width="56"
                height="6.5"
                rx="3"
                fill={kitSecondary}
                stroke={inkColor}
                strokeWidth="3"
              />
            </g>
          )}

          {headgear === "headphones" && (
            <g>
              {/* Headband band */}
              <path
                d="M 21 32 Q 21 2 50 2 Q 79 2 79 32"
                fill="none"
                stroke="#1E293B"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 21 32 Q 21 2 50 2 Q 79 2 79 32"
                fill="none"
                stroke={inkColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Left ear cushion */}
              <rect
                x="17"
                y="20"
                width="9"
                height="18"
                rx="3.5"
                fill={kitPrimary}
                stroke={inkColor}
                strokeWidth="3"
              />
              {/* Right ear cushion */}
              <rect
                x="74"
                y="20"
                width="9"
                height="18"
                rx="3.5"
                fill={kitPrimary}
                stroke={inkColor}
                strokeWidth="3"
              />
            </g>
          )}



          {/* Facial Face Group - Positioned over head (dx=24, dy=10) */}
          <g transform="translate(25, 12)" className="text-slate-900 select-none">
            {/* Expression-specific facial vector lines */}
            {renderFace()}
          </g>
        </motion.g>
      </motion.svg>
    </div>
  );
}
