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
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0E1A",
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
