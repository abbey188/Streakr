"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { FeedItem } from "../types";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import { fetchMyGroups, sendSquadMessage, type GroupSummary } from "@/lib/api/client";
import { buildMomentAttachment } from "@/lib/social/moment";
import MomentAttachmentCard from "./MomentAttachmentCard";

/**
 * Share-to-squad sheet: pick a squad, add an optional take, and drop a Live-Feed
 * moment into the Squad Room as a rich card. The whole thesis of the feed — a
 * goal becomes a group argument in two taps.
 */
export default function ShareMomentSheet({ item }: { item: FeedItem }) {
  const identity = useIdentity();
  const app = useAppState();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [take, setTake] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // iOS scroll-lock while open: pin the body so focusing the take box can't
  // scroll the page and shove the sheet around. Same proven approach as the
  // full-screen Squad Room; the overlay itself is pinned to the visual viewport
  // (--app-top / --app-h) so it always sits centered above the keyboard.
  useEffect(() => {
    const b = document.body;
    const scrollY = window.scrollY;
    const prev = { position: b.style.position, top: b.style.top, width: b.style.width, overflow: b.style.overflow };
    b.style.position = "fixed"; b.style.top = `-${scrollY}px`; b.style.width = "100%"; b.style.overflow = "hidden";
    return () => {
      b.style.position = prev.position; b.style.top = prev.top; b.style.width = prev.width; b.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const att = buildMomentAttachment(item);

  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) { setLoading(false); return; }
    let cancelled = false;
    fetchMyGroups(wallet)
      .then((g) => { if (!cancelled) { setGroups(g); if (g.length) setSelected(g[0].id); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [identity.walletAddress]);

  const selectedGroup = groups.find((g) => g.id === selected);

  const send = async () => {
    if (!selected || !identity.walletAddress || sending) return;
    setSending(true);
    try {
      await sendSquadMessage(selected, identity.walletAddress, take.trim(), undefined, att);
      app.closeMomentShare();
      // Drop the user straight into the squad they just shared to (no toast — the
      // transition into the chat is the confirmation).
      router.push(`/groups?open=${selected}&squad=1`);
    } catch {
      app.triggerToast("Couldn't share — try again.");
      setSending(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      style={{ top: "var(--app-top, 0px)", height: "var(--app-h, 100dvh)" }}
      onClick={app.closeMomentShare}
    >
      <div
        className="w-full max-w-md max-h-full overflow-y-auto bg-[#0C1224] border border-white/10 rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Share to squad</h3>
          <button onClick={app.closeMomentShare} aria-label="Close" className="text-[#A2A7AF] hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <MomentAttachmentCard att={att} />

        {loading ? (
          <p className="text-xs text-[#A2A7AF] mt-4 text-center py-3">Loading your squads…</p>
        ) : groups.length === 0 ? (
          <div className="mt-4 text-center py-4">
            <p className="text-xs text-[#A2A7AF]">You&apos;re not in a squad yet.</p>
            <button
              onClick={() => { app.closeMomentShare(); router.push("/groups"); }}
              className="mt-2 text-xs font-black text-[#FF4E00] hover:underline"
            >
              Join or create one →
            </button>
          </div>
        ) : (
          <>
            {groups.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ${
 selected === g.id
 ? "bg-[#FF4E00]/15 border-[#FF4E00]/40 text-white"
 : "bg-[#151B2E] border-white/5 text-[#A2A7AF] hover:text-white"
 }`}
                  >
                    <span>{g.emoji || "🛡️"}</span>
                    <span className="whitespace-nowrap">{g.name}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={take}
              onChange={(e) => setTake(e.target.value)}
              placeholder="Add your take… (optional)"
              rows={2}
              maxLength={500}
              className="mt-3 w-full bg-[#151B2E] border border-white/10 rounded-xl px-3 py-2.5 text-slate-100 placeholder:text-[#A2A7AF]/60 focus:outline-none focus:border-[#FF4E00]/40 resize-none"
              style={{ fontSize: "16px" }}
            />

            <button
              onClick={send}
              disabled={sending || !selected}
              className="mt-2 w-full bg-[#FF4E00] text-white font-black uppercase text-xs py-3 rounded-xl disabled:opacity-60 hover:bg-[#ff5e15] transition"
            >
              {sending ? "Sending…" : `Send to ${selectedGroup?.name ?? "squad"}`}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
