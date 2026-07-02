import React from "react";
import { AvatarConfig } from "../types";
import AvatarCustomizer from "./AvatarCustomizer";

interface ScreenIdentityProps {
  onConfirm: (config: AvatarConfig) => void;
}

/**
 * Create-fan-identity step (onboarding). Page chrome + the shared
 * AvatarCustomizer, so it's guaranteed identical to the Profile mascot editor.
 * No back button — this is the first-run identity step with nowhere to go back to.
 */
export default function ScreenIdentity({ onConfirm }: ScreenIdentityProps) {
  return (
    <div className="flex flex-col min-h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-8 relative">
      {/* Customizer — top-aligned so scrolling behaves (centering a tall,
          height-changing customizer inside a scroll area yanks scroll to top). */}
      <div className="flex flex-col w-full z-10 px-6 pt-8 lg:pt-10">
        <AvatarCustomizer confirmLabel="Lock In Fan Identity" onConfirm={onConfirm} />
      </div>
    </div>
  );
}
