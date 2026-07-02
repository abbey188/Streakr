import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Streakr — World Cup '26 Play",
  description:
    "Pick which team advances each knockout match. Build your streak, climb your group, earn bragging rights. World Cup 2026.",
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
