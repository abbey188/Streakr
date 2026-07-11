"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AvatarRenderer from "./AvatarRenderer";
import { fetchSquadFeed, toggleSquadReaction, sendSquadMessage } from "@/lib/api/client";
import { SQUAD_REACTIONS } from "@/lib/social/reactions";
import type { SquadItem, SquadReaction } from "../types";
import { Plus, CornerDownRight, Send } from "lucide-react";

/**
 * The Squad Room stream for one group — see docs/social/SQUAD_ROOM.md.
 * Phase 2: renders the merged feed (system events + member messages) with the
 * agreed visual language (mascot-led rows; events carry a coloured edge + type
 * chip, wins glow and breaks fade; messages are bubbles) and working, optimistic
 * reactions. Messaging (the composer) arrives in Phase 3.
 */

// Per-event-type styling: coloured edge, chip label, and emotion (win glows,
// break fades). Neutral milestone/badge sit plainly between.
const EVENT_META: Record<
  string,
  { edge: string; chipText: string; chipCls: string; emotion?: "glow" | "fade" }
> = {
  milestone: { edge: "#FF4E00", chipText: "🔥 Streak", chipCls: "text-[#FF8A54] bg-[#FF4E00]/15" },
  win:       { edge: "#F5B301", chipText: "👑 Crown",  chipCls: "text-[#F5C543] bg-[#F5B301]/15", emotion: "glow" },
  break:     { edge: "#EF4444", chipText: "💀 Broken", chipCls: "text-[#F87171] bg-[#EF4444]/15", emotion: "fade" },
  badge:     { edge: "#A855F7", chipText: "🎖️ Badge",  chipCls: "text-[#C084FC] bg-[#A855F7]/15" },
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Mascot({ avatar }: { avatar: SquadItem["avatar"] }) {
  return (
    <AvatarRenderer
      skinTone={avatar.skinTone}
      kitPrimary={avatar.kitPrimary}
      kitSecondary={avatar.kitSecondary}
      expression={avatar.expression}
      size="sm"
      isAnimated={false}
      upperBodyOnly
    />
  );
}

export default function SquadRoom({
  groupId,
  walletAddress,
}: {
  groupId: string;
  walletAddress?: string;
}) {
  const [items, setItems] = useState<SquadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    return fetchSquadFeed(groupId, walletAddress).then(setItems);
  }, [groupId, walletAddress]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .catch(() => { if (!cancelled) setError("Couldn't load the squad room."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  async function sendRoot() {
    const text = draft.trim();
    if (!text || !walletAddress || sending) return;
    setSending(true);
    try {
      await sendSquadMessage(groupId, walletAddress, text);
      setDraft("");
      await load();
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch {
      /* keep the draft so nothing is lost */
    } finally {
      setSending(false);
    }
  }

  async function sendReply(item: SquadItem) {
    const text = replyDraft.trim();
    if (!text || !walletAddress || sending) return;
    setSending(true);
    try {
      await sendSquadMessage(groupId, walletAddress, text, {
        type: item.kind === "event" ? "event" : "message",
        id: item.id,
      });
      setReplyDraft("");
      setReplyTo(null);
      await load();
    } catch {
      /* keep the draft */
    } finally {
      setSending(false);
    }
  }

  // Optimistically apply a reaction toggle to one item's summary.
  function applyToggle(reactions: SquadReaction[], emoji: string): SquadReaction[] {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (!existing) return [...reactions, { emoji, count: 1, mine: true }];
    if (existing.mine) {
      const next = reactions
        .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
        .filter((r) => r.count > 0);
      return next;
    }
    return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
  }

  async function react(item: SquadItem, emoji: string) {
    if (!walletAddress) return; // not signed in → read-only
    setPaletteFor(null);
    const snapshot = items;
    // optimistic
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, reactions: applyToggle(it.reactions, emoji) } : it))
    );
    try {
      const { reactions } = await toggleSquadReaction(
        groupId,
        walletAddress,
        item.kind === "event" ? "event" : "message",
        item.id,
        emoji
      );
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, reactions } : it)));
    } catch {
      setItems(snapshot); // revert on failure
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">
        Loading squad room…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-center text-[11px] text-red-400">{error}</div>
    );
  }
  return (
    <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-4 shadow-xl">
      <div className="flex flex-col gap-3.5">
        {items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-2xl mb-3">💬</p>
            <p className="text-sm font-black italic uppercase text-white">Quiet in here</p>
            <p className="text-[11px] text-[#8E9299] mt-1.5 max-w-[30ch] mx-auto leading-relaxed">
              Say something to your squad. Streaks, results and crowns land here automatically too.
            </p>
          </div>
        )}
        {items.map((item) => {
          const meta = item.kind === "event" ? EVENT_META[item.eventType ?? "milestone"] : null;
          const isEvent = item.kind === "event";
          return (
            <div key={item.id}>
              <div
                className={`flex gap-2.5 items-start ${
                  isEvent
                    ? `border border-white/5 border-l-[3px] rounded-[5px_16px_16px_5px] p-2.5 ${
                        meta?.emotion === "fade" ? "opacity-60" : ""
                      }`
                    : ""
                }`}
                style={
                  isEvent
                    ? {
                        borderLeftColor: meta?.edge,
                        ...(meta?.emotion === "glow"
                          ? {
                              background: "linear-gradient(115deg, rgba(245,179,1,0.12), transparent 62%)",
                              boxShadow: "0 8px 30px -14px rgba(245,179,1,0.35)",
                              borderColor: "rgba(245,179,1,0.28)",
                            }
                          : {}),
                      }
                    : undefined
                }
              >
                <div className="w-9 h-9 rounded-xl bg-[#0A0E1A] border border-white/5 p-0.5 flex-shrink-0 overflow-hidden">
                  <Mascot avatar={item.avatar} />
                </div>
                <div className="min-w-0 flex-1">
                  {isEvent && meta && (
                    <span className={`inline-flex items-center gap-1 text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mb-1 ${meta.chipCls}`}>
                      {meta.chipText}
                    </span>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-black italic truncate ${item.isMine ? "text-[#FF4E00]" : "text-white"}`}>
                      @{item.username}
                    </span>
                    <span className="text-[9px] font-mono text-[#8E9299] flex-shrink-0">{timeLabel(item.timestamp)}</span>
                  </div>
                  {isEvent ? (
                    <p className="text-[13px] text-slate-300 leading-snug mt-0.5">{item.body}</p>
                  ) : (
                    <div className="mt-1 inline-block bg-[#0A0E1A] border border-white/5 rounded-[4px_14px_14px_14px] px-2.5 py-1.5 text-[13px] text-slate-200 leading-snug">
                      {item.body}
                    </div>
                  )}

                  {/* reaction bar */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 relative">
                    {item.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => react(item, r.emoji)}
                        disabled={!walletAddress}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition cursor-pointer disabled:cursor-default ${
                          r.mine
                            ? "border-[#FF4E00]/45 bg-[#FF4E00]/12"
                            : "border-white/5 bg-[#0A0E1A] hover:border-white/15"
                        }`}
                      >
                        {r.emoji}
                        <span className={`text-[10px] font-mono font-bold tabular-nums ${r.mine ? "text-[#FF4E00]" : "text-[#8E9299]"}`}>
                          {r.count}
                        </span>
                      </button>
                    ))}
                    {walletAddress && (
                      <button
                        onClick={() => setPaletteFor(paletteFor === item.id ? null : item.id)}
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 border border-white/5 bg-[#0A0E1A] text-[#8E9299] hover:text-white hover:border-white/15 transition cursor-pointer"
                        aria-label="Add reaction"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {paletteFor === item.id && (
                      <div className="absolute z-20 bottom-full left-0 mb-1.5 flex gap-1 bg-[#151B2E] border border-white/10 rounded-2xl px-2 py-1.5 shadow-2xl">
                        {SQUAD_REACTIONS.map((e) => (
                          <button
                            key={e}
                            onClick={() => react(item, e)}
                            className="text-lg leading-none px-1 py-0.5 rounded-lg hover:bg-white/5 hover:scale-125 transition cursor-pointer"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                    {walletAddress && (
                      <button
                        onClick={() => { setReplyTo(replyTo === item.id ? null : item.id); setReplyDraft(""); }}
                        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#8E9299] hover:text-white transition cursor-pointer ml-0.5"
                      >
                        <CornerDownRight className="w-3 h-3" /> Reply
                      </button>
                    )}
                  </div>

                  {/* replies — one level */}
                  {item.replies.length > 0 && (
                    <div className="mt-2.5 ml-1.5 pl-3.5 border-l border-white/10 flex flex-col gap-2.5">
                      {item.replies.map((rep) => (
                        <div key={rep.id} className="flex gap-2 items-start">
                          <div className="w-6 h-6 rounded-lg bg-[#0A0E1A] border border-white/5 p-0.5 flex-shrink-0 overflow-hidden">
                            <Mascot avatar={rep.avatar} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-[11px] font-black italic truncate ${rep.isMine ? "text-[#FF4E00]" : "text-white"}`}>
                                @{rep.username}
                              </span>
                              <span className="text-[8px] font-mono text-[#8E9299]">{timeLabel(rep.timestamp)}</span>
                            </div>
                            <div className="mt-0.5 inline-block bg-[#0A0E1A] border border-white/5 rounded-[4px_12px_12px_12px] px-2.5 py-1.5 text-[12px] text-slate-200 leading-snug">
                              {rep.body}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* inline reply composer */}
                  {replyTo === item.id && walletAddress && (
                    <div className="mt-2.5 ml-1.5 pl-3.5 border-l border-[#FF4E00]/30 flex items-center gap-2">
                      <input
                        autoFocus
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") sendReply(item); if (e.key === "Escape") setReplyTo(null); }}
                        placeholder={`Reply to @${item.username}…`}
                        className="flex-1 bg-[#0A0E1A] border border-white/10 focus:border-[#FF4E00]/50 rounded-xl px-3 py-2 text-[12px] text-white placeholder-[#8E9299]/70 outline-none"
                      />
                      <button
                        onClick={() => sendReply(item)}
                        disabled={!replyDraft.trim() || sending}
                        className="w-8 h-8 rounded-lg bg-[#FF4E00] hover:bg-orange-600 text-white grid place-items-center flex-shrink-0 disabled:opacity-50 cursor-pointer"
                        aria-label="Send reply"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      {walletAddress ? (
        <div className="mt-4 flex items-center gap-2.5 border-t border-white/5 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendRoot(); }}
            placeholder="Message your squad…"
            className="flex-1 bg-[#0A0E1A] border border-white/10 focus:border-[#FF4E00]/50 rounded-2xl px-3.5 py-2.5 text-[13px] text-white placeholder-[#8E9299] outline-none"
          />
          <button
            onClick={sendRoot}
            disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#FF4E00] hover:bg-orange-600 text-white grid place-items-center flex-shrink-0 disabled:opacity-50 cursor-pointer"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="mt-4 border-t border-white/5 pt-3 text-center text-[11px] text-[#8E9299]">
          Sign in to join the conversation.
        </div>
      )}
    </div>
  );
}
