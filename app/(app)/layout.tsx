"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Bell, Users, User, Tv } from "lucide-react";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import { fetchUnreadCount } from "@/lib/api/client";
import LoadingSplash from "@/src/components/LoadingSplash";
import ShareSheets from "@/src/components/ShareSheets";

const NAV_ITEMS = [
  { label: "Play", icon: Flame, href: "/play" },
  { label: "Hub", icon: Tv, href: "/hub" },
  { label: "Groups", icon: Users, href: "/groups" },
  { label: "Inbox", icon: Bell, href: "/inbox" },
  { label: "Profile", icon: User, href: "/profile" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const app = useAppState();
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  // Keyboard-aware shell: iOS/Android don't shrink the layout (dvh) when the
  // on-screen keyboard opens — it just overlays, burying the bottom nav and any
  // pinned composer. We track the *visual* viewport instead: drive the app
  // height off it (so content fits above the keyboard) and hide the bottom nav
  // while it's open (like iMessage hides its tab bar), so a chat composer lands
  // flush above the keys.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      document.documentElement.style.setProperty("--app-h", `${vv.height}px`);
      // offsetTop lets a fixed overlay (the full-screen Squad Room) pin itself to
      // the VISIBLE viewport even when iOS scrolls the page under the keyboard.
      document.documentElement.style.setProperty("--app-top", `${vv.offsetTop}px`);
      setKeyboardOpen(window.innerHeight - vv.height > 120);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Poll the unread notification count for the Inbox nav badge; clear it while
  // the user is actually on the Inbox (the page marks everything read on open).
  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    if (pathname === "/inbox") { setUnreadCount(0); return; }
    let cancelled = false;
    const load = () => {
      // Skip while the tab is backgrounded; refresh immediately on refocus.
      if (typeof document !== "undefined" && document.hidden) return;
      fetchUnreadCount(wallet)
        .then((n) => { if (!cancelled) setUnreadCount(n); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [identity.walletAddress, pathname]);

  // ─── Auth/onboarding guard ────────────────────────────────────────────────
  useEffect(() => {
    if (identity.isLoading || app.profileStatus === "loading") return;
    if (!identity.isAuthenticated) {
      router.replace("/");
    } else if (app.profileStatus === "none") {
      router.replace("/onboarding/identity");
    }
  }, [identity.isLoading, identity.isAuthenticated, app.profileStatus, router]);

  // While resolving (or redirecting away), show the universal splash.
  if (identity.isLoading || app.profileStatus !== "ready" || !identity.isAuthenticated) {
    return <LoadingSplash />;
  }

  const isActive = (href: string) => pathname === href;
  // A live match glows the Hub nav icon to pull you into the feed (the icon
  // itself never changes — this is a live-state cue, not a swap).
  const anyLive = app.fixtures.some((f) => f.status === "live");

  return (
    <div className="min-h-dvh bg-[#0A0E1A] text-white flex flex-col lg:flex-row font-sans selection:bg-[#FF4E00] selection:text-white antialiased overflow-hidden relative">

      {/* Toast */}
      <AnimatePresence>
        {app.toastMessage && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bg-[#151B2E] border-2 border-[#FF4E00] text-slate-100 font-black italic text-xs px-4 py-2.5 rounded-2xl shadow-2xl z-50 flex items-center gap-2 max-w-xs text-center shadow-[0_0_15px_rgba(255,78,0,0.4)]"
            style={{ top: "calc(1.5rem + env(safe-area-inset-top))" }}
          >
            <span className="text-[#FF4E00]">🔥</span>
            <span>{app.toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex flex-col lg:flex-row w-full overflow-hidden"
        style={{ height: "var(--app-h, 100dvh)" }}
      >

        {/* PC LEFT SIDEBAR */}
        <aside className="hidden lg:flex flex-col justify-between w-80 bg-[#151B2E] border-r border-white/5 p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF4E00] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,78,0,0.4)]">
                <Flame className="w-6 h-6 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter text-[#FF4E00]">STREAKR</h1>
                <span className="text-[9px] font-mono text-[#8E9299] font-bold uppercase tracking-widest block leading-none mt-0.5">
                  World Cup &apos;26
                </span>
              </div>
            </div>

            <nav className="space-y-1.5 pt-4">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    id={`nav-pc-${item.label.toLowerCase()}`}
                    href={item.href}
                    onClick={() => app.closeShareSheet()}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black italic transition cursor-pointer ${
                      active
                        ? "bg-[#FF4E00] text-white shadow-[0_4px_12px_rgba(255,78,0,0.25)]"
                        : "text-[#8E9299] hover:bg-[#2D364F]/40 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-4.5 h-4.5 ${
                        item.href === "/hub" && anyLive && !active
                          ? "text-[#FF4E00] drop-shadow-[0_0_6px_rgba(255,78,0,0.75)] animate-pulse"
                          : ""
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.href === "/hub" && anyLive && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-widest text-red-500 not-italic">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                      </span>
                    )}
                    {item.href === "/inbox" && unreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF4E00] text-white text-[10px] font-black flex items-center justify-center not-italic">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* MAIN — pad the top by the status-bar/notch inset so screen headers
            clear the clock in standalone mode (env is 0 elsewhere; nav is a
            flex child at the bottom, so it's unaffected). */}
        <main
          className="flex-grow h-full flex flex-col overflow-hidden relative bg-[#0A0E1A]"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex-grow overflow-hidden relative w-full h-full flex flex-col">
            {children}

            {/* Share sheet overlay */}
            {app.activeShareSheet && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-0 sm:p-6 md:p-12 bg-black/75 backdrop-blur-sm">
                <div className="w-full max-w-md h-full sm:h-[780px] sm:border sm:border-slate-800 sm:rounded-[36px] overflow-hidden relative bg-slate-950 shadow-2xl">
                  <ShareSheets
                    avatar={app.avatar}
                    streak={app.streak}
                    personalBest={app.personalBest}
                    groupName={app.shareGroupInfo?.name || "🏆 Local Legends WC"}
                    inviteCode={app.shareGroupInfo?.inviteCode || "STREAK-99X"}
                    leaderboard={app.shareGroupInfo?.leaderboard || app.leaderboard}
                    groupEmoji={app.shareGroupInfo?.emoji}
                    onClose={app.closeShareSheet}
                    isOnlyStreak={app.activeShareSheet === "streak"}
                    isOnlyInvite={app.activeShareSheet === "invite"}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mobile bottom nav — pad the bottom by the home-indicator inset
              (env resolves to 0 on devices without one, so nothing shifts there). */}
          <nav
            className={`${keyboardOpen ? "hidden" : "lg:hidden flex"} bg-[#151B2E] border-t border-white/5 pt-2.5 px-3 justify-between items-center z-30 select-none`}
            style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  id={`nav-mobile-${item.label.toLowerCase()}`}
                  href={item.href}
                  onClick={() => app.closeShareSheet()}
                  className={`relative flex flex-col items-center justify-center flex-1 cursor-pointer transition ${
                    active ? "text-[#FF4E00] scale-105" : "text-[#8E9299] hover:text-slate-300"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${active ? "fill-[#FF4E00]/10" : ""} ${
                      item.href === "/hub" && anyLive && !active
                        ? "text-[#FF4E00] drop-shadow-[0_0_6px_rgba(255,78,0,0.8)] animate-pulse"
                        : ""
                    }`}
                  />
                  {item.href === "/hub" && anyLive && (
                    <span className="absolute top-0 right-[26%] w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-[#151B2E]" />
                  )}
                  {item.href === "/inbox" && unreadCount > 0 && (
                    <span className="absolute top-0 right-[22%] min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#FF4E00] text-white text-[8px] font-black flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  <span className="text-[9px] font-bold mt-1 tracking-tight">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </main>
      </div>
    </div>
  );
}
