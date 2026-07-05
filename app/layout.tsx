import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Streakr — World Cup '26",
  description:
    "Pick which team advances each knockout match. Build your streak, climb your group, earn bragging rights. World Cup 2026.",
  applicationName: "Streakr",
  // iOS "Add to Home Screen": launch standalone (no Safari chrome) with our name.
  appleWebApp: {
    capable: true,
    title: "Streakr",
    // "black" (not translucent) keeps content below the status bar so top
    // headers don't slide under the clock in standalone mode.
    statusBarStyle: "black",
  },
  icons: {
    // Declaring `icons` overrides Next's file-convention icons, so the browser
    // favicon must be listed explicitly here too (else the tab icon disappears).
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0E1A",
  // Fill the screen edge-to-edge in standalone mode AND expose the real
  // env(safe-area-inset-*) values so the bottom nav can clear the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0A0E1A] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
