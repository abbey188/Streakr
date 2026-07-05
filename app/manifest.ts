import type { MetadataRoute } from "next";

/**
 * PWA web app manifest. Makes Streakr installable ("Add to Home Screen") so it
 * launches standalone (no browser chrome) with our flame icon — and is the
 * prerequisite for iOS web push later. Served by Next at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Streakr — World Cup '26",
    short_name: "Streakr",
    description:
      "Pick which team advances each knockout match. Build your streak, climb your group, earn bragging rights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0E1A",
    theme_color: "#0A0E1A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
