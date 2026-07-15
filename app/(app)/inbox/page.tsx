"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchNotifications, markNotificationsRead, fetchMyGroupsActivity, clearNotifications,
} from "@/lib/api/client";
import { getCached, setCached } from "@/lib/state/cache";
import type { Notification, ActivityItem } from "@/src/types";
import ScreenInbox from "@/src/components/ScreenInbox";

export default function InboxPage() {
  const identity = useIdentity();
  // Seed from cache so re-opening the Inbox shows the last feed instantly.
  const [notifications, setNotifications] = useState<Notification[]>(
    () => getCached<Notification[]>("notifications") ?? []
  );
  const [groupActivity, setGroupActivity] = useState<ActivityItem[]>(
    () => getCached<ActivityItem[]>("groupActivity") ?? []
  );

  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    let cancelled = false;
    const load = () => {
      fetchNotifications(wallet)
        .then((rows) => { if (!cancelled) { setNotifications(rows); setCached("notifications", rows); } })
        .catch(() => { /* keep last feed on failure */ });
      fetchMyGroupsActivity(wallet)
        .then((rows) => { if (!cancelled) { setGroupActivity(rows); setCached("groupActivity", rows); } })
        .catch(() => { /* keep last feed on failure */ });
    };
    load();
    // Keep the feed live while open; re-mark read so the nav badge clears.
    const t = setInterval(() => { load(); markNotificationsRead(wallet).catch(() => {}); }, 30_000);
    markNotificationsRead(wallet).catch(() => {});
    return () => { cancelled = true; clearInterval(t); };
  }, [identity.walletAddress]);

  const handleClearNotifications = () => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    setNotifications([]); // optimistic
    clearNotifications(wallet).catch(() => {});
  };

  return (
    <ScreenInbox
      activityList={groupActivity}
      notifications={notifications}
      onClearNotifications={handleClearNotifications}
    />
  );
}
