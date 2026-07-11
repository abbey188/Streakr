import React, { useState, useEffect } from "react";
import { GroupMember } from "../types";
import type { GroupSummary, GlobalLeaderboardEntry, LeaderboardType } from "@/lib/api/client";
import AvatarRenderer from "./AvatarRenderer";
import CountryFlag from "./CountryFlag";
import SquadRoom from "./SquadRoom";
import { Users, Plus, ChevronUp, ChevronDown, Minus, Crown, Share2, Flame, ArrowLeft, Award } from "lucide-react";
import { motion } from "motion/react";

interface ScreenGroupsProps {
  currentUserMember: GroupMember;
  myGroups: GroupSummary[];
  walletAddress?: string;
  onCreateGroup: (name: string, emoji: string, leaderboardType: LeaderboardType) => Promise<GroupSummary | null>;
  onJoinGroup: (code: string) => Promise<{ group: GroupSummary | null; error?: string }>;
  loadGroupMembers: (groupId: string) => Promise<GlobalLeaderboardEntry[]>;
  onOpenInviteShare: (groupName: string, inviteCode: string, members: GroupMember[], emoji?: string) => void;
}

const AVAILABLE_EMOJIS = [
  "🏆", "⚽", "🔥", "⚡", "👑", "🎯", "🛡️", "🍀", "💎", "🌟",
  "👾", "🚀", "🎨", "🍕", "🎸", "🥊", "🦁", "🌎", "🔮", "🎩",
];

const LEADERBOARD_TYPE_OPTIONS: { id: LeaderboardType; label: string }[] = [
  { id: "streak", label: "Active Streak" },
  { id: "points", label: "Points" },
  { id: "both", label: "Both" },
];

/** Single leaderboard row. `metric` decides whether the streak or points value shows. */
function MemberRow({
  member, currentUsername, metric,
}: { member: GlobalLeaderboardEntry; currentUsername: string; metric: "streak" | "points" }) {
  const isCurrentUser = member.isCurrentUser || member.username === currentUsername;
  return (
    <div className={`flex items-center justify-between gap-2 p-3.5 transition ${isCurrentUser ? "bg-[#FF4E00]/10" : "hover:bg-white/2"}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex flex-col items-center justify-center min-w-[28px] text-center flex-shrink-0">
          <span className={`text-xs font-mono font-black ${member.rank === 1 ? "text-amber-400" : member.rank === 2 ? "text-slate-300" : "text-[#8E9299]"}`}>
            #{member.rank}
          </span>
          {member.change === "up" ? (
            <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : member.change === "down" ? (
            <ChevronDown className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Minus className="w-3 h-3 text-slate-600" />
          )}
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#0A0E1A] border border-white/5 p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
          <AvatarRenderer
            skinTone={member.avatar.skinTone}
            kitPrimary={member.avatar.kitPrimary}
            kitSecondary={member.avatar.kitSecondary}
            expression={member.avatar.expression}
            size="sm"
            isAnimated={false}
            upperBodyOnly={true}
          />
        </div>
        <span className="text-xs font-black italic text-slate-200 flex items-center gap-1.5 min-w-0">
          {member.avatar.nation && <CountryFlag name={member.avatar.nation} className="w-4 h-3 flex-shrink-0" width={40} />}
          <span className="truncate">@{member.username}</span>
          {isCurrentUser && (
            <span className="text-[8px] font-black bg-[#FF4E00] text-white px-1.5 py-0.5 rounded uppercase leading-none flex-shrink-0">Me</span>
          )}
          {member.rank === 1 && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
        </span>
      </div>
      {metric === "points" ? (
        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-2xl shadow-inner flex-shrink-0">
          <Award className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-black font-mono text-indigo-400">{member.points}P</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-[#FF4E00]/10 border border-[#FF4E00]/20 px-3 py-1 rounded-2xl shadow-inner flex-shrink-0">
          <Flame className="w-3.5 h-3.5 text-[#FF4E00] fill-[#FF4E00]/20" />
          <span className="text-xs font-black font-mono text-[#FF4E00]">{member.streak}</span>
        </div>
      )}
    </div>
  );
}

export default function ScreenGroups({
  currentUserMember,
  myGroups,
  walletAddress,
  onCreateGroup,
  onJoinGroup,
  loadGroupMembers,
  onOpenInviteShare,
}: ScreenGroupsProps) {
  const [selectedGroup, setSelectedGroup] = useState<GroupSummary | null>(null);
  const [groupMembers, setGroupMembers] = useState<GlobalLeaderboardEntry[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // For a "both" group, which metric the detail view is currently ranked by.
  const [detailMetric, setDetailMetric] = useState<"streak" | "points">("streak");
  // Which panel of the open group is showing.
  const [detailTab, setDetailTab] = useState<"leaderboard" | "squad">("leaderboard");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("🏆");
  const [newGroupType, setNewGroupType] = useState<LeaderboardType>("streak");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // Load real members whenever a group is opened; default the ranking metric to
  // the group's type (points-type → points; streak/both → streak first).
  useEffect(() => {
    if (!selectedGroup) return;
    setDetailMetric(selectedGroup.leaderboardType === "points" ? "points" : "streak");
    setDetailTab("leaderboard");
    let cancelled = false;
    setLoadingMembers(true);
    loadGroupMembers(selectedGroup.id)
      .then((m) => { if (!cancelled) setGroupMembers(m); })
      .catch(() => { if (!cancelled) setGroupMembers([]); })
      .finally(() => { if (!cancelled) setLoadingMembers(false); });
    return () => { cancelled = true; };
  }, [selectedGroup, loadGroupMembers]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creating) return;
    setCreating(true);
    const group = await onCreateGroup(newGroupName.trim(), newGroupEmoji, newGroupType);
    setCreating(false);
    if (group) {
      setNewGroupName("");
      setNewGroupEmoji("🏆");
      setNewGroupType("streak");
      setShowCreateModal(false);
      setSelectedGroup(group);
    }
  };

  // Members ranked by the detail view's active metric.
  const rankedMembers = [...groupMembers]
    .sort((a, b) =>
      detailMetric === "points"
        ? b.points - a.points || b.streak - a.streak
        : b.streak - a.streak || b.points - a.points
    )
    .map((m, i) => ({ ...m, rank: i + 1 }));

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joining) return;
    setJoining(true);
    setJoinError("");
    const { group, error } = await onJoinGroup(joinCode.trim());
    setJoining(false);
    if (group) {
      setJoinCode("");
      setSelectedGroup(group);
    } else {
      setJoinError(error || "No group found for that code.");
    }
  };

  const getMyRank = (members: GroupMember[]) => {
    const idx = members.findIndex((m) => m.isCurrentUser || m.username === currentUserMember.username);
    return idx !== -1 ? idx + 1 : members.length || 1;
  };

  // ─── Group detail view ─────────────────────────────────────────────────────
  if (selectedGroup) {
    const isSquad = detailTab === "squad";
    return (
      // When the Squad Room is open it becomes a full-height chat: the page
      // stops scrolling (overflow-hidden) so the messages scroll internally and
      // the composer can pin to the bottom. Leaderboard keeps the scrolling page.
      <div className={`flex flex-col h-full bg-[#0A0E1A] text-white font-sans relative ${isSquad ? "overflow-hidden" : "overflow-y-auto pb-12"}`}>
        <div className="sticky top-0 bg-[#0A0E1A]/85 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3 z-30 flex-shrink-0">
          <button onClick={() => setSelectedGroup(null)} className="p-1.5 hover:bg-white/5 rounded-xl transition text-slate-400 hover:text-white cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="not-italic text-lg flex-shrink-0">{selectedGroup.emoji}</span>
            <h2 className="text-sm font-black italic tracking-tighter uppercase text-white whitespace-nowrap">{selectedGroup.name}</h2>
          </div>
        </div>

        {/* Tab switcher — always visible under the header */}
        <div className="px-4 pt-4 max-w-7xl mx-auto w-full flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex gap-1 bg-[#0A0E1A] p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setDetailTab("leaderboard")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${!isSquad ? "bg-[#FF4E00]/10 text-[#FF4E00]" : "text-[#8E9299] hover:text-white"}`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setDetailTab("squad")}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${isSquad ? "bg-[#FF4E00]/10 text-[#FF4E00]" : "text-[#8E9299] hover:text-white"}`}
            >
              Squad Room
            </button>
          </div>
          {!isSquad && selectedGroup.leaderboardType === "both" && (
            <div className="flex gap-1 bg-[#0A0E1A] p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setDetailMetric("streak")}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer ${detailMetric === "streak" ? "bg-[#FF4E00]/10 text-[#FF4E00]" : "text-[#8E9299] hover:text-white"}`}
              >
                <Flame className="w-3 h-3 fill-current" /> Streak
              </button>
              <button
                onClick={() => setDetailMetric("points")}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer ${detailMetric === "points" ? "bg-indigo-500/10 text-indigo-400" : "text-[#8E9299] hover:text-white"}`}
              >
                <Award className="w-3 h-3" /> Points
              </button>
            </div>
          )}
        </div>

        {isSquad ? (
          <div className="flex-1 min-h-0 px-4 pt-3 pb-4 max-w-7xl mx-auto w-full flex flex-col">
            <SquadRoom groupId={selectedGroup.id} walletAddress={walletAddress} />
          </div>
        ) : (
          <div className="px-4 mt-4 space-y-5 flex-grow max-w-7xl mx-auto w-full z-10">
            <div className="bg-[#151B2E] border border-white/5 p-4 rounded-3xl flex items-center justify-between shadow-lg">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block leading-none">Group Invite Code</span>
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <span className="not-italic text-sm flex-shrink-0">{selectedGroup.emoji}</span>
                  <h3 className="text-sm font-black italic text-slate-200 whitespace-nowrap">{selectedGroup.name}</h3>
                </div>
                <p className="text-[10px] text-[#8E9299] mt-2 font-mono">
                  Invite Code: <span className="text-[#FF4E00] font-black italic">{selectedGroup.inviteCode}</span>
                </p>
              </div>
              <button
                onClick={() => onOpenInviteShare(selectedGroup.name, selectedGroup.inviteCode, groupMembers, selectedGroup.emoji)}
                className="p-2.5 bg-[#0A0E1A] hover:bg-[#2D364F]/50 border border-white/5 rounded-2xl text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-black italic cursor-pointer ml-2 flex-shrink-0"
              >
                <Share2 className="w-4 h-4 text-[#FF4E00]" /> Invite
              </button>
            </div>

            <div className="bg-[#151B2E] rounded-3xl border border-white/5 overflow-hidden divide-y divide-white/5 shadow-xl">
              {loadingMembers ? (
                <div className="p-6 text-center text-[10px] font-mono text-[#8E9299] uppercase tracking-wider">Loading members…</div>
              ) : rankedMembers.length === 0 ? (
                <div className="p-6 text-center text-[10px] font-mono text-[#8E9299] uppercase tracking-wider">No members yet — share the code!</div>
              ) : (
                rankedMembers.map((m) => (
                  <MemberRow key={m.id} member={m} currentUsername={currentUserMember.username} metric={detailMetric} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Groups list (main view) ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] text-white font-sans overflow-y-auto pb-12 relative">
      <div className="sticky top-0 bg-[#0A0E1A]/85 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 p-1.5 rounded-lg text-[#FF4E00]">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-black italic tracking-tighter uppercase text-white">Groups</h2>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="text-[10px] font-black italic bg-[#FF4E00] hover:bg-orange-650 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Create Group
        </button>
      </div>

      <div className="px-4 mt-4 space-y-5 flex-grow max-w-md mx-auto w-full z-10">
        {/* Join */}
        <div className="bg-[#151B2E] border border-white/5 p-4 rounded-3xl shadow-lg">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">Join Group</h3>
          <form onSubmit={handleJoinGroup} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Enter Code (e.g. STK-AB12X)"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
              className="flex-grow bg-[#0A0E1A] border border-white/10 focus:border-[#FF4E00] rounded-xl px-3.5 py-2 text-xs uppercase text-white placeholder-slate-650 outline-none"
            />
            <button type="submit" disabled={joining} className="bg-[#FF4E00] hover:bg-orange-650 text-white text-xs font-black italic px-4 py-2 rounded-xl transition cursor-pointer flex-shrink-0 disabled:opacity-60">
              {joining ? "…" : "Join"}
            </button>
          </form>
          {joinError && <p className="text-[10px] font-bold text-red-400 mt-2">{joinError}</p>}
        </div>

        {/* Groups list */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-mono font-black text-[#8E9299] uppercase tracking-widest pl-1">Your Active Groups</h4>
          {myGroups.length === 0 ? (
            <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-6 text-center">
              <p className="text-xs text-[#8E9299] leading-relaxed">No groups yet. Create one or join with a code to start a streak battle with friends.</p>
            </div>
          ) : (
            myGroups.map((group) => (
              <motion.div
                key={group.id}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedGroup(group)}
                className="bg-[#151B2E] border border-white/5 hover:border-white/10 p-4 rounded-3xl flex items-center justify-between shadow-md transition cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-xl flex-shrink-0 not-italic">{group.emoji}</div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black italic text-slate-100 uppercase tracking-tight truncate">{group.name}</h3>
                    <p className="text-[10px] font-mono text-[#8E9299] mt-0.5 uppercase tracking-wider">
                      {group.memberCount} {group.memberCount === 1 ? "Member" : "Members"} • Code: {group.inviteCode}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[8px] font-mono font-black text-[#8E9299] uppercase tracking-wider">Members</span>
                  <span className="text-sm font-mono font-black text-[#FF4E00]">{group.memberCount}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#0A0E1A]/95 z-50 flex flex-col justify-center p-6">
          <div className="bg-[#151B2E] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 max-w-sm mx-auto w-full">
            <h3 className="text-base font-black italic text-white uppercase tracking-tight">Create Custom Group</h3>
            <p className="text-xs text-[#8E9299] leading-relaxed">Name your group and pick an emoji to build your custom streak battle lobby.</p>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Champs League Elite"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-[#0A0E1A] border border-white/10 focus:border-[#FF4E00] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-650 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block">Select Emoji</label>
                <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 bg-[#0A0E1A] rounded-xl border border-white/5">
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewGroupEmoji(emoji)}
                      className={`py-2 text-lg rounded-xl border transition cursor-pointer ${newGroupEmoji === emoji ? "bg-[#FF4E00]/10 border-[#FF4E00] text-white" : "bg-[#0A0E1A]/50 border-white/5 text-slate-400 hover:border-white/10"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leaderboard type — creator's choice of how this group ranks. */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-[#8E9299] uppercase tracking-widest block">Rank Members By</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEADERBOARD_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewGroupType(opt.id)}
                      className={`py-2 rounded-xl border text-[10px] font-black italic uppercase tracking-wide transition cursor-pointer ${newGroupType === opt.id ? "bg-[#FF4E00]/10 border-[#FF4E00] text-white" : "bg-[#0A0E1A]/50 border-white/5 text-slate-400 hover:border-white/10"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] font-mono text-[#8E9299] leading-relaxed pt-0.5">
                  {newGroupType === "both"
                    ? "Members can toggle between active streak and points."
                    : newGroupType === "points"
                    ? "Ranked by lifetime points."
                    : "Ranked by active streak."}
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="w-1/2 bg-[#0A0E1A] hover:bg-[#2D364F]/30 border border-white/5 text-slate-400 text-xs font-bold py-2.5 rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" disabled={creating} className="w-1/2 bg-[#FF4E00] hover:bg-orange-650 text-white text-xs font-black italic py-2.5 rounded-xl cursor-pointer disabled:opacity-60">
                  {creating ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
