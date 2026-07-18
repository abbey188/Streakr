"use client";

import { useEffect } from "react";
import { Flame, RefreshCw } from "lucide-react";

/**
 * Route-level error boundary — catches uncaught render/runtime errors anywhere
 * in the app tree and shows a branded fallback with a retry, instead of a blank
 * white screen. (global-error.tsx covers the rare case of the root layout itself
 * throwing.)
 */
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  // A hard reload, not Next's reset(): reset() only re-renders the crashed
  // subtree and can drop straight back into the same error after a real outage.
  // A full reload reliably recovers once the app is reachable again.
  const retry = () => window.location.reload();

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col items-center justify-center gap-5 p-6 text-center font-sans">
      <div className="w-14 h-14 bg-[#FF4E00] rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(255,78,0,0.5)]">
        <Flame className="w-8 h-8 text-white fill-white" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-black italic uppercase tracking-tight">Something went sideways</h1>
        <p className="text-xs text-[#A2A7AF] max-w-xs leading-relaxed">
          A hiccup on our end — your streak, points and picks are all safe. Give it another go.
        </p>
      </div>
      <button
        onClick={retry}
        className="bg-[#FF4E00] hover:bg-orange-600 text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
