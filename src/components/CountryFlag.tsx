import React from "react";
import { flagUrl } from "@/lib/txline/countries";

/**
 * Renders a real country flag image (flagcdn) from a country name. We use
 * images rather than flag emoji because Windows/Chrome don't render flag emoji
 * at all (they show two letters or a blank box). Unknown countries fall back to
 * a neutral globe so the layout never breaks.
 *
 * `className` controls the box size (e.g. "w-8 h-6"); the flag fills it with a
 * subtle rounded frame so different aspect ratios sit consistently.
 */
export default function CountryFlag({
  name,
  className = "w-6 h-4",
  width = 80,
}: {
  name?: string | null;
  className?: string;
  width?: 40 | 80 | 160;
}) {
  const url = flagUrl(name, width);
  if (!url) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-[3px] bg-white/5 border border-white/10 text-[10px] leading-none`}
        aria-label={name ?? "flag"}
      >
        🏳️
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external flag CDN, no next/image optimization needed
    <img
      src={url}
      alt={name ?? "flag"}
      loading="lazy"
      className={`${className} object-cover rounded-[3px] border border-white/10 shadow-sm`}
    />
  );
}
