import React from "react";
import { Crosshair } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FootballIcon,
  ArrowDataTransferVerticalIcon,
  TvIcon,
  TargetIcon,
  FlagIcon,
  WhistleIcon,
  ActivityIcon,
  Clock01Icon,
  FootballPitchIcon,
} from "@hugeicons/core-free-icons";

/**
 * The ONE source of truth for match-event icons — Feed, Timeline and shared Squad
 * cards all render through this, so the same event always looks the same.
 *
 * A few events use their own thing on purpose: goals are the ⚽ emoji (the one
 * emoji that renders everywhere, and its colour makes the hero moment pop); free
 * kicks are the Crosshair (danger-coloured); cards are coloured rectangles (reads
 * as a real card). Everything else is the uniform Hugeicons vector set.
 */
type IconEntry = { icon: typeof FootballIcon; color: string };

const MAP: Record<string, IconEntry> = {
  penalty_missed: { icon: FootballIcon, color: "#8E9299" },
  sub: { icon: ArrowDataTransferVerticalIcon, color: "#5EC26A" },
  var: { icon: TvIcon, color: "#a78bfa" },
  shot: { icon: TargetIcon, color: "#e2e8f0" },
  corner: { icon: FlagIcon, color: "#38bdf8" },
  momentum: { icon: ActivityIcon, color: "#FF4E00" },
  status: { icon: WhistleIcon, color: "#A2A7AF" },
  stoppage: { icon: Clock01Icon, color: "#A2A7AF" },
  lineup: { icon: FootballPitchIcon, color: "#A2A7AF" },
};

export default function EventIcon({
  type,
  payload,
  size = 18,
  strokeWidth = 2,
  className,
}: {
  type: string;
  payload?: Record<string, unknown>;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  // Goals: the ⚽ emoji — colourful and universally recognised.
  if (type === "goal" || type === "penalty") {
    return (
      <span className={className} style={{ fontSize: Math.round(size * 0.92), lineHeight: 1 }} aria-label="goal">
        ⚽
      </span>
    );
  }

  // Cards read best as the real thing: a coloured rounded rectangle.
  if (type === "yellow" || type === "red") {
    return (
      <span
        className={`inline-block rounded-[3px] ${type === "red" ? "bg-red-500" : "bg-yellow-400"} ${className ?? ""}`}
        style={{ width: Math.round(size * 0.66), height: size }}
        aria-label={type === "red" ? "red card" : "yellow card"}
      />
    );
  }

  // Free kicks: the Crosshair — orange if dangerous, grey if routine.
  if (type === "freekick") {
    const c = (payload as { dangerous?: boolean })?.dangerous ? "#FF4E00" : "#94a3b8";
    return <Crosshair size={size} color={c} strokeWidth={2.25} className={className} />;
  }

  const entry = MAP[type] ?? { icon: ActivityIcon, color: "#A2A7AF" };
  return <HugeiconsIcon icon={entry.icon} size={size} color={entry.color} strokeWidth={strokeWidth} className={className} />;
}
