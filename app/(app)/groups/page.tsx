"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "@/lib/identity/context";
import { useAppState } from "@/lib/state/app-state";
import ScreenGroups from "@/src/components/ScreenGroups";
import type { GroupMember } from "@/src/types";
import {
  fetchMyGroups, createGroup, joinGroup, fetchLeaderboard,
  type GroupSummary, type LeaderboardType,
} from "@/lib/api/client";

export default function GroupsPage() {
  const identity = useIdentity();
  const app = useAppState();
  const wallet = identity.walletAddress;

  const [myGroups, setMyGroups] = useState<GroupSummary[]>([]);

  const refreshGroups = useCallback(() => {
    if (!wallet) return;
    fetchMyGroups(wallet).then(setMyGroups).catch(() => {});
  }, [wallet]);

  useEffect(() => {
    if (!wallet) return;
    refreshGroups();
  }, [wallet, refreshGroups]);

  const handleCreateGroup = useCallback(
    async (name: string, emoji: string, leaderboardType: LeaderboardType): Promise<GroupSummary | null> => {
      if (!wallet) return null;
      try {
        const group = await createGroup(wallet, name, emoji, leaderboardType);
        refreshGroups();
        return group;
      } catch {
        app.triggerToast("Couldn't create group — try again.");
        return null;
      }
    },
    [wallet, refreshGroups, app]
  );

  const handleJoinGroup = useCallback(
    async (code: string): Promise<{ group: GroupSummary | null; error?: string }> => {
      if (!wallet) return { group: null, error: "Not signed in" };
      try {
        const group = await joinGroup(wallet, code);
        if (group) refreshGroups();
        return { group, error: group ? undefined : "No group found for that code." };
      } catch {
        return { group: null, error: "Couldn't join — try again." };
      }
    },
    [wallet, refreshGroups]
  );

  const loadGroupMembers = useCallback(
    (groupId: string) => fetchLeaderboard(groupId, wallet ?? undefined),
    [wallet]
  );

  return (
    <ScreenGroups
      currentUserMember={{
        id: "currentUser",
        rank: 0,
        username: app.avatar.username,
        avatar: app.avatar,
        streak: app.streak,
        change: "same",
        isCurrentUser: true,
      }}
      myGroups={myGroups}
      onCreateGroup={handleCreateGroup}
      onJoinGroup={handleJoinGroup}
      loadGroupMembers={loadGroupMembers}
      onOpenInviteShare={(name, inviteCode, members, emoji) =>
        app.openShareSheet("invite", { name, inviteCode, leaderboard: members, emoji })
      }
    />
  );
}
