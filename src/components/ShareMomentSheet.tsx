"use client";

import { useState, useEffect } from "react";
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
      app.triggerToast(`Shared to ${selectedGroup?.name ?? "your squad"} 🔥`);
      app.closeMomentShare();
    } catch {
      app.triggerToast("Couldn't share — try again.");
      setSending(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={app.closeMomentShare}
    >
      <div
        className="w-full max-w-md max-h-full overflow-y-auto bg-[#0C1224] border border-white/10 rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Share to squad</h3>
          <button onClick={app.closeMomentShare} aria-label="Close" className="text-[#8E9299] hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <MomentAttachmentCard att={att} />

        {loading ? (
          <p className="text-xs text-[#8E9299] mt-4 text-center py-3">Loading your squads…</p>
        ) : groups.length === 0 ? (
          <div className="mt-4 text-center py-4">
            <p className="text-xs text-[#8E9299]">You&apos;re not in a squad yet.</p>
            <button
              onClick={() => { app.closeMomentShare(); router.push("/groups"); }}
              className="mt-2 text-xs font-black italic text-[#FF4E00] hover:underline"
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
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold italic transition ${
                      selected === g.id
                        ? "bg-[#FF4E00]/15 border-[#FF4E00]/40 text-white"
                        : "bg-[#151B2E] border-white/5 text-[#8E9299] hover:text-white"
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
              className="mt-3 w-full bg-[#151B2E] border border-white/10 rounded-xl px-3 py-2.5 text-slate-100 placeholder:text-[#8E9299]/60 focus:outline-none focus:border-[#FF4E00]/40 resize-none"
              style={{ fontSize: "16px" }}
            />

            <button
              onClick={send}
              disabled={sending || !selected}
              className="mt-2 w-full bg-[#FF4E00] text-white font-black italic uppercase text-xs py-3 rounded-xl disabled:opacity-60 hover:bg-[#ff5e15] transition"
            >
              {sending ? "Sending…" : `Send to ${selectedGroup?.name ?? "squad"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
