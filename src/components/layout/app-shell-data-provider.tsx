"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { AppNotification } from "@/lib/notifications";
import type { SetupGuideProgress } from "@/lib/setup-guide";

type AccountData = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  permissions: string[];
};

type NotificationData = {
  notifications: AppNotification[];
  unreadCount: number;
};

type ApiEnvelope<T> = {
  data?: T;
};

type AppShellDataContextValue = {
  account: AccountData | null;
  accountLoading: boolean;
  refreshAccount: () => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  notificationsLoading: boolean;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (key: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  setupGuide: SetupGuideProgress | null;
  setupGuideLoading: boolean;
  refreshSetupGuide: () => Promise<void>;
};

const emptyNotifications: NotificationData = {
  notifications: [],
  unreadCount: 0,
};

const AppShellDataContext = createContext<AppShellDataContextValue | null>(null);

export function useAppShellData() {
  const context = useContext(AppShellDataContext);
  if (!context) {
    throw new Error("useAppShellData must be used inside AppShellDataProvider");
  }
  return context;
}

export function AppShellDataProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [notificationData, setNotificationData] = useState<NotificationData>(emptyNotifications);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [setupGuide, setSetupGuide] = useState<SetupGuideProgress | null>(null);
  const [setupGuideLoading, setSetupGuideLoading] = useState(false);
  const notificationsLoadedRef = useRef(false);

  const refreshAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<AccountData>;
      setAccount(response.ok && json.data ? json.data : null);
    } catch {
      setAccount(null);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!notificationsLoadedRef.current) {
      setNotificationsLoading(true);
    }
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<NotificationData>;
      if (response.ok && json.data) {
        setNotificationData(json.data);
      }
    } catch {
      // The app shell stays usable if notification loading fails.
    } finally {
      notificationsLoadedRef.current = true;
      setNotificationsLoading(false);
    }
  }, []);

  const refreshSetupGuide = useCallback(async () => {
    if (account?.role !== "ADMIN") {
      setSetupGuide(null);
      setSetupGuideLoading(false);
      return;
    }

    setSetupGuideLoading(true);
    try {
      const response = await fetch("/api/setup-guide", { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<SetupGuideProgress>;
      setSetupGuide(response.ok && json.data ? json.data : null);
    } catch {
      setSetupGuide(null);
    } finally {
      setSetupGuideLoading(false);
    }
  }, [account?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAccount(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshAccount]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshNotifications(), 0);
    const interval = window.setInterval(() => void refreshNotifications(), 60_000);
    const refreshOnFocus = () => void refreshNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (accountLoading) return;
    const timer = window.setTimeout(() => void refreshSetupGuide(), 0);
    return () => window.clearTimeout(timer);
  }, [accountLoading, refreshSetupGuide]);

  const markNotificationRead = useCallback(async (key: string) => {
    setNotificationData((current) => ({
      notifications: current.notifications.map((item) =>
        item.key === key ? { ...item, read: true } : item,
      ),
      unreadCount: Math.max(
        0,
        current.unreadCount -
          (current.notifications.some((item) => item.key === key && !item.read) ? 1 : 0),
      ),
    }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", key }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const keys = notificationData.notifications.filter((item) => !item.read).map((item) => item.key);
    if (keys.length === 0) return;

    setNotificationData((current) => ({
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
      unreadCount: 0,
    }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read", keys }),
    }).catch(() => {});
  }, [notificationData.notifications]);

  const value = useMemo<AppShellDataContextValue>(
    () => ({
      account,
      accountLoading,
      refreshAccount,
      notifications: notificationData.notifications,
      unreadCount: notificationData.unreadCount,
      notificationsLoading,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      setupGuide,
      setupGuideLoading,
      refreshSetupGuide,
    }),
    [
      account,
      accountLoading,
      refreshAccount,
      notificationData.notifications,
      notificationData.unreadCount,
      notificationsLoading,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      setupGuide,
      setupGuideLoading,
      refreshSetupGuide,
    ],
  );

  return <AppShellDataContext.Provider value={value}>{children}</AppShellDataContext.Provider>;
}
