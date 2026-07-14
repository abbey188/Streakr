"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import AvatarRenderer from "./AvatarRenderer";
import { fetchSquadFeed, toggleSquadReaction, sendSquadMessage, deleteSquadMessage } from "@/lib/api/client";
import { SQUAD_REACTIONS } from "@/lib/social/reactions";
import { eventPredicate } from "@/lib/social/phrasing";
import type { SquadItem, SquadReaction, AvatarConfig } from "../types";
import MomentAttachmentCard from "./MomentAttachmentCard";
import { Plus, CornerUpLeft, Send, X, ChevronDown, Trash2 } from "lucide-react";

/**
 * Squad Room stream — see docs/social/SQUAD_ROOM.md (v2).
 *
 * Two things in one timeline:
 *  - MESSAGES render as chat: grouped bubbles, "You" for the viewer, reactions
 *    hugging the bubble. Swipe → reply (Telegram quote), tap → react palette
 *    (mobile); hover toolbar on PC. A reply carries a quoted snippet inline.
 *  - EVENTS render as collapsible cards: coloured edge + type chip, wins glow /
 *    breaks fade. Tap to expand the Slack-style thread (avatars + count +
 *    chevron); react via ＋ / palette.
 */

const EVENT_META: Record<
  string,
  { edge: string; chip: string; chipCls: string; emotion?: "glow" | "fade" }
> = {
  milestone: { edge: "#FF4E00", chip: "🔥 Streak", chipCls: "text-[#FF8A54] bg-[#FF4E00]/15" },
  win:       { edge: "#F5B301", chip: "👑 Crown",  chipCls: "text-[#F5C543] bg-[#F5B301]/15", emotion: "glow" },
  break:     { edge: "#EF4444", chip: "💀 Broken", chipCls: "text-[#F87171] bg-[#EF4444]/15", emotion: "fade" },
  badge:     { edge: "#A855F7", chip: "🎖️ Badge",  chipCls: "text-[#C084FC] bg-[#A855F7]/15" },
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** AvatarRenderer renders at a fixed ~60px (size sm); scale it to fit `px`
 *  without cropping. Fixes the clipped avatars in the first build. */
function Mascot({ avatar, px }: { avatar: SquadItem["avatar"]; px: number }) {
  return (
    <div
      className="rounded-[inherit] overflow-hidden flex items-center justify-center bg-[#0A0E1A]"
      style={{ width: px, height: px }}
    >
      <div style={{ transform: `scale(${px / 60})`, transformOrigin: "center" }}>
        <AvatarRenderer
          skinTone={avatar.skinTone}
          kitPrimary={avatar.kitPrimary}
          kitSecondary={avatar.kitSecondary}
          expression={avatar.expression}
          size="sm"
          isAnimated={false}
          upperBodyOnly
        />
      </div>
    </div>
  );
}

function Palette({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="flex gap-1 bg-[#151B2E] border border-white/10 rounded-2xl px-2 py-1.5 shadow-2xl">
      {SQUAD_REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="text-lg leading-none px-1 py-0.5 rounded-lg hover:bg-white/5 hover:scale-125 transition cursor-pointer"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function ReactionChips({
  reactions,
  onToggle,
  size = "sm",
}: {
  reactions: SquadReaction[];
  onToggle: (emoji: string) => void;
  size?: "sm" | "xs";
}) {
  if (reactions.length === 0) return null;
  const pad = size === "xs" ? "px-1.5 py-0" : "px-2 py-0.5";
  return (
    <>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={`inline-flex items-center gap-1 rounded-full ${pad} text-xs border transition cursor-pointer ${
            r.mine ? "border-[#FF4E00]/45 bg-[#FF4E00]/12" : "border-white/5 bg-[#0A0E1A] hover:border-white/15"
          }`}
        >
          {r.emoji}
          <span className={`text-[10px] font-mono font-bold tabular-nums ${r.mine ? "text-[#FF4E00]" : "text-[#8E9299]"}`}>
            {r.count}
          </span>
        </button>
      ))}
    </>
  );
}

type ReplyTarget = { id: string; username: string; body: string };

export default function SquadRoom({
  groupId,
  walletAddress,
  me,
}: {
  groupId: string;
  walletAddress?: string;
  me?: { username: string; avatar: AvatarConfig };
}) {
  const [items, setItems] = useState<SquadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [msgPaletteFor, setMsgPaletteFor] = useState<string | null>(null);
  const [eventPaletteFor, setEventPaletteFor] = useState<string | null>(null);
  const [eventReplyDraft, setEventReplyDraft] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => fetchSquadFeed(groupId, walletAddress).then(setItems), [groupId, walletAddress]);

  useEffect(() => {
    if (!walletAddress) { setLoading(false); setItems([]); return; } // read is members-only
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .catch(() => { if (!cancelled) setError("Couldn't load the squad room."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, walletAddress]);

  const scrollToEnd = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  const isNearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  const firstLoad = useRef(true);

  // A tap anywhere outside an open reaction palette closes it. Registered a frame
  // later so the click that opened it doesn't immediately close it again.
  useEffect(() => {
    if (!msgPaletteFor && !eventPaletteFor) return;
    const close = () => { setMsgPaletteFor(null); setEventPaletteFor(null); };
    const raf = requestAnimationFrame(() => document.addEventListener("click", close));
    return () => { cancelAnimationFrame(raf); document.removeEventListener("click", close); };
  }, [msgPaletteFor, eventPaletteFor]);

  // Poll while the room is open so a teammate's messages appear live (~8s).
  // Skips while backgrounded to save work.
  useEffect(() => {
    if (!walletAddress) return;
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load().catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [walletAddress, load]);

  // Land at the newest message on open, and follow new ones only if you're
  // already near the bottom — so a polled message doesn't yank you down while
  // you're reading history. Reactions don't change the count, so no jump.
  useEffect(() => {
    if (firstLoad.current || isNearBottom()) {
      endRef.current?.scrollIntoView({ block: "end" });
      if (items.length > 0) firstLoad.current = false;
    }
  }, [items.length]);

  // Keyboard-aware: when the on-screen keyboard opens it shrinks the visual
  // viewport — keep the newest line visible above it. iOS-standalone PWA is the
  // finicky case tuned on device; this covers the common browsers.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  function applyToggle(reactions: SquadReaction[], emoji: string): SquadReaction[] {
    const ex = reactions.find((r) => r.emoji === emoji);
    if (!ex) return [...reactions, { emoji, count: 1, mine: true }];
    if (ex.mine) return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
    return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
  }

  async function react(item: SquadItem, emoji: string) {
    if (!walletAddress || item.id.startsWith("temp-")) return; // not yet reconciled
    setMsgPaletteFor(null);
    setEventPaletteFor(null);
    const snapshot = items;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, reactions: applyToggle(it.reactions, emoji) } : it)));
    try {
      const { reactions } = await toggleSquadReaction(groupId, walletAddress, item.kind === "event" ? "event" : "message", item.id, emoji);
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, reactions } : it)));
    } catch {
      setItems(snapshot);
    }
  }

  async function deleteMessage(item: SquadItem) {
    if (!walletAddress || item.id.startsWith("temp-")) return;
    setMsgPaletteFor(null);
    const snapshot = items;
    // Optimistically blank it; reconcile against the server.
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, deleted: true, body: "", reactions: [] } : it)));
    try {
      await deleteSquadMessage(groupId, item.id, walletAddress);
    } catch {
      setItems(snapshot);
    }
  }

  function startReply(item: SquadItem) {
    if (item.id.startsWith("temp-")) return; // not yet reconciled
    setReplyTo({ id: item.id, username: item.isMine ? "You" : `@${item.username}`, body: item.body });
    inputRef.current?.focus();
  }

  async function sendRoot() {
    const text = draft.trim();
    if (!text || !walletAddress || sending) return;
    const replying = replyTo;
    // Clear the input immediately and drop the message in optimistically — the
    // send feels instant; load() reconciles it against the real feed.
    setDraft("");
    setReplyTo(null);
    const tempId = `temp-${Date.now()}`;
    if (me) {
      setItems((prev) => [
        ...prev,
        {
          id: tempId, kind: "message", username: me.username, avatar: me.avatar,
          body: text, timestamp: new Date().toISOString(), isMine: true,
          reactions: [], replies: [],
          quoted: replying
            ? { username: replying.username.replace(/^@/, ""), body: replying.body, isMine: replying.username === "You" }
            : null,
        },
      ]);
      scrollToEnd();
    }
    setSending(true);
    try {
      await sendSquadMessage(groupId, walletAddress, text, replying ? { type: "message", id: replying.id } : undefined);
      // Unlock the composer the moment the message is persisted — reconcile the
      // real feed in the background so typing the next line never waits on a poll.
      setSending(false);
      load().then(() => scrollToEnd()).catch(() => {});
    } catch {
      // Roll back the optimistic message and restore the draft.
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      setDraft(text);
      setReplyTo(replying);
      setSending(false);
    }
  }

  async function sendEventReply(eventId: string) {
    const text = eventReplyDraft.trim();
    if (!text || !walletAddress || sending) return;
    setSending(true);
    try {
      await sendSquadMessage(groupId, walletAddress, text, { type: "event", id: eventId });
      setEventReplyDraft("");
      await load();
    } catch { /* keep draft */ } finally { setSending(false); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <div className="p-8 text-center text-[10px] font-mono text-[#8E9299] uppercase tracking-widest">Loading squad room…</div>;
  if (error) return <div className="p-8 text-center text-[11px] text-red-400">{error}</div>;

  return (
    <div className="bg-[#151B2E] border border-white/5 rounded-3xl shadow-xl flex flex-col h-full overflow-hidden">
      <div ref={scrollRef} className="thin-scroll flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0 p-3.5">
        {items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-2xl mb-3">💬</p>
            <p className="text-sm font-black italic uppercase text-white">Quiet in here</p>
            <p className="text-[11px] text-[#8E9299] mt-1.5 max-w-[30ch] mx-auto leading-relaxed">
              Say something to your squad. Streaks, results and crowns land here automatically too.
            </p>
          </div>
        )}

        {items.map((item, i) => {
          const prev = items[i - 1];
          if (item.kind === "event") {
            return (
              <EventCard
                key={item.id}
                item={item}
                open={expanded.has(item.id)}
                onToggle={() => toggleExpand(item.id)}
                onReact={(e) => react(item, e)}
                paletteOpen={eventPaletteFor === item.id}
                onPalette={() => setEventPaletteFor(eventPaletteFor === item.id ? null : item.id)}
                canWrite={!!walletAddress}
                replyDraft={eventReplyDraft}
                setReplyDraft={setEventReplyDraft}
                onSendReply={() => sendEventReply(item.id)}
                sending={sending}
              />
            );
          }
          // grouped continuation: same author, adjacent message, not a quote-reply
          const grouped =
            prev &&
            prev.kind === "message" &&
            prev.username === item.username &&
            prev.isMine === item.isMine &&
            !item.quoted &&
            new Date(item.timestamp).getTime() - new Date(prev.timestamp).getTime() < 5 * 60000;
          return (
            <ChatMessage
              key={item.id}
              item={item}
              grouped={!!grouped}
              canWrite={!!walletAddress}
              onReact={(e) => react(item, e)}
              onReply={() => startReply(item)}
              onDelete={() => deleteMessage(item)}
              paletteOpen={msgPaletteFor === item.id}
              onOpenPalette={() => setMsgPaletteFor(msgPaletteFor === item.id ? null : item.id)}
            />
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer — pinned; reply preview + input are ONE bordered unit (Telegram-style) */}
      <div className="flex-shrink-0 px-3.5 pb-3.5 pt-3 border-t border-white/5">
        {walletAddress ? (
          <div className="flex items-end gap-2.5">
            <div className="flex-1 bg-[#0A0E1A] border border-white/10 focus-within:border-[#FF4E00]/50 rounded-2xl overflow-hidden transition-colors">
              {replyTo && (
                <div className="flex items-start gap-2 px-3 pt-2 pb-1.5 border-b border-white/5">
                  <CornerUpLeft className="w-3.5 h-3.5 text-[#FF4E00] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#FF4E00]">Reply to {replyTo.username}</div>
                    <div className="text-[11px] text-[#8E9299] truncate">{replyTo.body}</div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-[#8E9299] hover:text-white cursor-pointer flex-shrink-0" aria-label="Cancel reply">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendRoot(); if (e.key === "Escape") setReplyTo(null); }}
                onFocus={scrollToEnd}
                placeholder="Message your squad…"
                className="w-full bg-transparent px-3.5 py-2.5 text-[16px] text-white placeholder-[#8E9299] outline-none border-0"
              />
            </div>
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
          <div className="text-center text-[11px] text-[#8E9299]">Sign in to join the conversation.</div>
        )}
      </div>
    </div>
  );
}

/* ─── chat message ─── */
function ChatMessage({
  item,
  grouped,
  canWrite,
  onReact,
  onReply,
  onDelete,
  paletteOpen,
  onOpenPalette,
}: {
  item: SquadItem;
  grouped: boolean;
  canWrite: boolean;
  onReact: (e: string) => void;
  onReply: () => void;
  onDelete: () => void;
  paletteOpen: boolean;
  onOpenPalette: () => void;
}) {
  // A deleted message keeps its slot but shows nothing interactive.
  if (item.deleted) {
    return (
      <div className="flex gap-2.5 items-start" style={{ paddingTop: grouped ? 1 : 5 }}>
        {grouped ? <div className="w-8 flex-shrink-0" /> : (
          <div className="rounded-xl border border-white/5 flex-shrink-0 opacity-50"><Mascot avatar={item.avatar} px={32} /></div>
        )}
        <div className="min-w-0 flex-1">
          {!grouped && (
            <div className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-black italic text-[#8E9299]">{item.isMine ? "You" : `@${item.username}`}</span>
              <span className="text-[8.5px] font-mono text-[#8E9299]">{timeLabel(item.timestamp)}</span>
            </div>
          )}
          <span className="inline-block mt-0.5 text-[12px] italic text-[#8E9299]/70">🚫 This message was deleted</span>
        </div>
      </div>
    );
  }
  const canDelete = canWrite && item.isMine;
  return (
    <motion.div
      className="group relative flex gap-2.5 items-start"
      style={{ paddingTop: grouped ? 1 : 5 }}
      drag={canWrite ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      dragSnapToOrigin
      onDragEnd={(_e, info) => { if (info.offset.x > 64) onReply(); }}
    >
      {grouped ? <div className="w-8 flex-shrink-0" /> : (
        <div className="rounded-xl border border-white/5 flex-shrink-0"><Mascot avatar={item.avatar} px={32} /></div>
      )}
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className={`text-[12.5px] font-black italic ${item.isMine ? "text-[#FF4E00]" : "text-white"}`}>
              {item.isMine ? "You" : `@${item.username}`}
            </span>
            <span className="text-[8.5px] font-mono text-[#8E9299]">{timeLabel(item.timestamp)}</span>
          </div>
        )}
        <div className="relative inline-block max-w-[88%] align-top">
          <button
            onClick={canWrite ? onOpenPalette : undefined}
            className="text-left bg-[#0A0E1A] border border-white/5 rounded-[4px_14px_14px_14px] px-2.5 py-1.5 mt-0.5 cursor-default"
          >
            {item.quoted && (
              <span className="block border-l-[3px] border-[#FF4E00] bg-[#FF4E00]/6 rounded-md px-2.5 py-1 mb-1.5">
                <span className="block text-[11px] font-black italic text-[#FF4E00] leading-tight">
                  {item.quoted.isMine ? "You" : `@${item.quoted.username}`}
                </span>
                <span className={`block text-[11px] truncate ${item.quoted.deleted ? "text-[#8E9299]/60 italic" : "text-[#8E9299]"}`}>
                  {item.quoted.deleted ? "message deleted" : item.quoted.body}
                </span>
              </span>
            )}
            {/* A shared Live-Feed moment renders as a card above the take. */}
            {item.attachment && (
              <span className={`block ${item.body ? "mb-1.5" : ""}`}>
                <MomentAttachmentCard att={item.attachment} />
              </span>
            )}
            {item.body && <span className="text-[13px] text-slate-200 leading-snug">{item.body}</span>}
          </button>

          {/* PC hover toolbar — anchored top-left, opening RIGHTWARD into the
              empty space beside a left-aligned bubble, so it never clips on the
              left/top edge of the scroll box (short bubbles used to cut it off). */}
          {canWrite && (
            <div className="hidden md:group-hover:flex absolute -top-3 left-2 items-center gap-0.5 bg-[#151B2E] border border-white/10 rounded-xl px-1 py-0.5 shadow-xl z-20">
              {["🔥", "😂", "👏"].map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-[15px] px-1 rounded hover:bg-white/5 cursor-pointer">{e}</button>
              ))}
              <span className="w-px h-4 bg-white/10 mx-0.5" />
              <button onClick={onOpenPalette} className="text-[#8E9299] hover:text-white px-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
              <button onClick={onReply} className="text-[#8E9299] hover:text-white px-1 cursor-pointer"><CornerUpLeft className="w-3.5 h-3.5" /></button>
              {canDelete && (
                <button onClick={onDelete} className="text-[#8E9299] hover:text-red-400 px-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          )}

          {paletteOpen && canWrite && (
            <div className="absolute z-20 bottom-full left-0 mb-1.5 flex items-center gap-1.5">
              <Palette onPick={onReact} />
              {canDelete && (
                <button onClick={onDelete} className="bg-[#151B2E] border border-white/10 rounded-2xl p-2 text-[#8E9299] hover:text-red-400 shadow-2xl cursor-pointer" aria-label="Delete message">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {item.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <ReactionChips reactions={item.reactions} onToggle={onReact} size="xs" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── event card (collapsible) ─── */
function EventCard({
  item,
  open,
  onToggle,
  onReact,
  paletteOpen,
  onPalette,
  canWrite,
  replyDraft,
  setReplyDraft,
  onSendReply,
  sending,
}: {
  item: SquadItem;
  open: boolean;
  onToggle: () => void;
  onReact: (e: string) => void;
  paletteOpen: boolean;
  onPalette: () => void;
  canWrite: boolean;
  replyDraft: string;
  setReplyDraft: (v: string) => void;
  onSendReply: () => void;
  sending: boolean;
}) {
  const meta = EVENT_META[item.eventType ?? "milestone"];
  const replies = item.replies;
  // The avatar stack shows unique PEOPLE — one person replying five times is
  // still one face. Count stays the total reply count.
  const repliers = replies.filter((r, i, arr) => arr.findIndex((x) => x.username === r.username) === i);
  return (
    <div
      className={`border border-white/5 border-l-[3px] rounded-[5px_16px_16px_5px] p-3 my-1.5 ${meta.emotion === "fade" ? "opacity-60" : ""}`}
      style={{
        borderLeftColor: meta.edge,
        ...(meta.emotion === "glow"
          ? { background: "linear-gradient(115deg, rgba(245,179,1,0.12), transparent 62%)", boxShadow: "0 8px 30px -14px rgba(245,179,1,0.35)", borderColor: "rgba(245,179,1,0.28)" }
          : {}),
      }}
    >
      {/* header — tapping toggles expand */}
      <button onClick={onToggle} className="w-full flex gap-2.5 items-start text-left cursor-pointer">
        <div className="rounded-xl border border-white/5 flex-shrink-0"><Mascot avatar={item.avatar} px={34} /></div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mb-1 ${meta.chipCls}`}>
            {meta.chip}
          </span>
          <div className="text-[13px] text-slate-300 leading-snug">
            <span className={`font-black italic ${item.isMine ? "text-[#FF4E00]" : "text-white"}`}>
              {item.isMine ? "You" : `@${item.username}`}
            </span>{" "}
            {eventPredicate(item.body, item.isMine)}
            <span className="text-[8.5px] font-mono text-[#8E9299] ml-1.5">{timeLabel(item.timestamp)}</span>
          </div>
        </div>
      </button>

      {/* footer / thread affordance */}
      <div className="flex items-center gap-2 mt-2.5 pl-[46px] flex-wrap relative">
        <ReactionChips reactions={item.reactions} onToggle={onReact} />
        {canWrite && (
          <button onClick={onPalette} className="inline-flex items-center rounded-full px-1.5 py-0.5 border border-white/5 bg-[#0A0E1A] text-[#8E9299] hover:text-white hover:border-white/15 cursor-pointer" aria-label="Add reaction">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        {paletteOpen && canWrite && (
          <div className="absolute z-20 bottom-full left-[46px] mb-1.5"><Palette onPick={onReact} /></div>
        )}
        <button onClick={onToggle} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 hover:bg-white/5 border border-transparent hover:border-white/5 cursor-pointer">
          {repliers.length > 0 && (
            <span className="flex">
              {repliers.slice(0, 3).map((r, idx) => (
                <span key={r.id} className="rounded-md border-[1.5px] border-[#151B2E] overflow-hidden" style={{ marginLeft: idx ? -6 : 0 }}>
                  <Mascot avatar={r.avatar} px={18} />
                </span>
              ))}
            </span>
          )}
          <span className="text-[10px] font-mono font-bold text-[#FF4E00]">
            {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "Reply"}
          </span>
          <ChevronDown className={`w-3 h-3 text-[#8E9299] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* expanded thread */}
      {open && (
        <div className="mt-2.5 ml-[46px]">
          {replies.length > 0 && (
            <div className="pl-3 border-l-[1.5px] border-white/10 flex flex-col gap-2.5 mb-2.5">
              {replies.map((r) => (
                <div key={r.id} className="flex gap-2 items-start">
                  <div className="rounded-lg border border-white/5 flex-shrink-0"><Mascot avatar={r.avatar} px={22} /></div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-[11px] font-black italic ${r.isMine ? "text-[#FF4E00]" : "text-white"}`}>
                        {r.isMine ? "You" : `@${r.username}`}
                      </span>
                      <span className="text-[8px] font-mono text-[#8E9299]">{timeLabel(r.timestamp)}</span>
                    </div>
                    {r.deleted ? (
                      <span className="mt-0.5 inline-block text-[11px] italic text-[#8E9299]/70">🚫 This message was deleted</span>
                    ) : (
                      <div className="mt-0.5 inline-block bg-[#0A0E1A] border border-white/5 rounded-[4px_12px_12px_12px] px-2.5 py-1.5 text-[12px] text-slate-200 leading-snug">{r.body}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canWrite && (
            <div className="flex items-center gap-2">
              <input
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSendReply(); }}
                placeholder={`Reply to ${item.isMine ? "your streak" : `@${item.username}`}…`}
                className="flex-1 bg-[#0A0E1A] border border-white/10 focus:border-[#FF4E00]/50 rounded-xl px-3 py-2 text-[16px] text-white placeholder-[#8E9299]/70 outline-none"
              />
              <button onClick={onSendReply} disabled={!replyDraft.trim() || sending} className="w-8 h-8 rounded-lg bg-[#FF4E00] hover:bg-orange-600 text-white grid place-items-center flex-shrink-0 disabled:opacity-50 cursor-pointer" aria-label="Send reply">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
