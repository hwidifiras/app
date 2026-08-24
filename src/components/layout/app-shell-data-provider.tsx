"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { AppNotification } from "@/lib/notifications";
import type { SetupGuideProgress } from "@/lib/setup-guide";

export type AccountData = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  coachId: string | null;
  isActive: boolean;
  permissions: string[];
  modules: string[];
  productProfile: "CLASS_ONLY" | "GYM_ONLY" | "HYBRID";
  productCapabilities: {
    classManagement: boolean;
    gymAccess: boolean;
    classSales: boolean;
    gymSales: boolean;
    mixedSales: boolean;
    classReports: boolean;
    gymReports: boolean;
  };
  saasStatus: "LEGACY_ACTIVE" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
  operationsAllowed: boolean;
  isDemoWorkspace: boolean;
  billingWarning: "TRIAL_ENDING" | "TRIAL_GRACE" | "PAST_DUE" | "GRACE" | null;
  subscriptionBlockReason:
    | "TENANT_SUSPENDED"
    | "TRIAL_EXPIRED"
    | "BILLING_GRACE_EXPIRED"
    | "SUBSCRIPTION_SUSPENDED"
    | "SUBSCRIPTION_CANCELLED"
    | null;
  subscriptionDeadlineAt: string | null;
  subscriptionDaysRemaining: number | null;
  saasSubscription: {
    id: string;
    planCode: string;
    planName: string;
    automaticLifecycle: boolean;
    startsAt: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
    userLimit: number | null;
    memberLimit: number | null;
  } | null;
};

type NotificationData = {
  notifications: AppNotification[];
  unreadCount: number;
};

export type NavigationBadge = {
  label: string;
  tone: "blue" | "amber" | "red";
};

type NavigationBadgeData = {
  badges: Record<string, NavigationBadge | null>;
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
  navBadges: Record<string, NavigationBadge | null>;
  navBadgesLoading: boolean;
  refreshNavBadges: () => Promise<void>;
};

const emptyNotifications: NotificationData = {
  notifications: [],
  unreadCount: 0,
};

const emptyNavigationBadges: NavigationBadgeData = {
  badges: {},
};

const AppShellDataContext = createContext<AppShellDataContextValue | null>(null);

export function useAppShellData() {
  const context = useContext(AppShellDataContext);
  if (!context) {
    throw new Error("useAppShellData must be used inside AppShellDataProvider");
  }
  return context;
}

export function AppShellDataProvider({
  children,
  initialAccount = null,
}: {
  children: React.ReactNode;
  initialAccount?: AccountData | null;
}) {
  const [account, setAccount] = useState<AccountData | null>(initialAccount);
  const [accountLoading, setAccountLoading] = useState(initialAccount === null);
  const [notificationData, setNotificationData] = useState<NotificationData>(emptyNotifications);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [setupGuide, setSetupGuide] = useState<SetupGuideProgress | null>(null);
  const [setupGuideLoading, setSetupGuideLoading] = useState(false);
  const [navBadgeData, setNavBadgeData] = useState<NavigationBadgeData>(emptyNavigationBadges);
  const [navBadgesLoading, setNavBadgesLoading] = useState(true);
  const notificationsLoadedRef = useRef(false);
  const notificationsInFlightRef = useRef<Promise<void> | null>(null);
  const lastNotificationsFetchRef = useRef(0);
  const navBadgesLoadedRef = useRef(false);
  const navBadgesInFlightRef = useRef<Promise<void> | null>(null);
  const lastNavBadgesFetchRef = useRef(0);
  const accountId = account?.id;

  const refreshAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<AccountData>;
      if (response.ok && json.data) {
        setAccount(json.data);
      } else if (response.status === 401 || response.status === 403) {
        setAccount(null);
      }
    } catch {
      // Preserve server-bootstrapped navigation during a transient refresh failure.
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const now = Date.now();
    if (notificationsLoadedRef.current && now - lastNotificationsFetchRef.current < 5_000) {
      return;
    }
    if (notificationsInFlightRef.current) {
      await notificationsInFlightRef.current;
      return;
    }

    const request = (async () => {
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
        lastNotificationsFetchRef.current = Date.now();
        setNotificationsLoading(false);
      }
    })();

    notificationsInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (notificationsInFlightRef.current === request) {
        notificationsInFlightRef.current = null;
      }
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

  const refreshNavBadges = useCallback(async () => {
    const now = Date.now();
    if (navBadgesLoadedRef.current && now - lastNavBadgesFetchRef.current < 15_000) {
      return;
    }
    if (navBadgesInFlightRef.current) {
      await navBadgesInFlightRef.current;
      return;
    }

    const request = (async () => {
      if (!navBadgesLoadedRef.current) {
        setNavBadgesLoading(true);
      }
      try {
        const response = await fetch("/api/navigation-badges", { cache: "no-store" });
        const json = (await response.json()) as ApiEnvelope<NavigationBadgeData>;
        if (response.ok && json.data) {
          setNavBadgeData(json.data);
        }
      } catch {
        // Navigation remains usable if operational badges are unavailable.
      } finally {
        navBadgesLoadedRef.current = true;
        lastNavBadgesFetchRef.current = Date.now();
        setNavBadgesLoading(false);
      }
    })();

    navBadgesInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (navBadgesInFlightRef.current === request) {
        navBadgesInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAccount(), initialAccount ? 15_000 : 0);
    return () => window.clearTimeout(timer);
  }, [initialAccount, refreshAccount]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };
    const timer = window.setTimeout(refreshWhenVisible, 0);
    const interval = window.setInterval(refreshWhenVisible, 120_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (accountLoading) return;
    const timer = window.setTimeout(() => void refreshSetupGuide(), 0);
    return () => window.clearTimeout(timer);
  }, [accountLoading, refreshSetupGuide]);

  useEffect(() => {
    if (accountLoading || !accountId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNavBadges();
    };
    const timer = window.setTimeout(refreshWhenVisible, 0);
    const interval = window.setInterval(refreshWhenVisible, 180_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [accountId, accountLoading, refreshNavBadges]);

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
      navBadges: navBadgeData.badges,
      navBadgesLoading,
      refreshNavBadges,
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
      navBadgeData.badges,
      navBadgesLoading,
      refreshNavBadges,
    ],
  );

  return <AppShellDataContext.Provider value={value}>{children}</AppShellDataContext.Provider>;
}
