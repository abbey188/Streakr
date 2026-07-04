"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchNotifications, markNotificationsRead, fetchMyGroupsActivity, clearNotifications,
} from "@/lib/api/client";
import type { Notification, ActivityItem } from "@/src/types";
import ScreenInbox from "@/src/components/ScreenInbox";

export default function InboxPage() {
  const identity = useIdentity();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [groupActivity, setGroupActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const wallet = identity.walletAddress;
    if (!wallet) return;
    let cancelled = false;
    const load = () => {
      fetchNotifications(wallet)
        .then((rows) => { if (!cancelled) setNotifications(rows); })
        .catch(() => { /* keep last feed on failure */ });
      fetchMyGroupsActivity(wallet)
        .then((rows) => { if (!cancelled) setGroupActivity(rows); })
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
