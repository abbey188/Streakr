"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity/context";
import {
  fetchNotifications, markNotificationsRead, fetchMyGroupsActivity,
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
    fetchNotifications(wallet)
      .then((rows) => { if (!cancelled) setNotifications(rows); })
      .catch(() => { /* keep empty feed on failure */ });
    fetchMyGroupsActivity(wallet)
      .then((rows) => { if (!cancelled) setGroupActivity(rows); })
      .catch(() => { /* keep empty feed on failure */ });
    // Opening the Inbox clears the unread state.
    markNotificationsRead(wallet).catch(() => {});
    return () => { cancelled = true; };
  }, [identity.walletAddress]);

  return <ScreenInbox activityList={groupActivity} notifications={notifications} />;
}
