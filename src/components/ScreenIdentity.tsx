import React from "react";
import { AvatarConfig } from "../types";
import { ArrowLeft } from "lucide-react";
import AvatarCustomizer from "./AvatarCustomizer";

interface ScreenIdentityProps {
  onBack: () => void;
  onConfirm: (config: AvatarConfig) => void;
}

/**
 * Create-fan-identity step (onboarding). Page chrome + the shared
 * AvatarCustomizer, so it's guaranteed identical to the Profile mascot editor.
 */
export default function ScreenIdentity({ onBack, onConfirm }: ScreenIdentityProps) {
  return (
    <div className="flex flex-col min-h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-4 relative">
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-6 pt-6 z-10 flex-shrink-0 max-w-5xl mx-auto w-full">
        <button
          onClick={onBack}
          className="p-2 bg-[#2D364F]/50 hover:bg-[#2D364F] rounded-full border border-white/5 text-slate-300 hover:text-white transition cursor-pointer"
          id="identity-back-button"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9" />
      </div>

      {/* Customizer */}
      <div className="flex-grow flex flex-col justify-center w-full z-10 px-6 py-4 lg:py-8">
        <AvatarCustomizer confirmLabel="Lock In Fan Identity" onConfirm={onConfirm} />
      </div>
    </div>
  );
}
