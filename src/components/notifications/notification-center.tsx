"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  LoaderCircle,
} from "lucide-react";

import type { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type NotificationResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

const severityStyles = {
  critical: {
    icon: "bg-red-500/12 text-red-600 dark:text-red-300",
    dot: "bg-red-500",
  },
  warning: {
    icon: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    icon: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    dot: "bg-sky-500",
  },
} as const;

export function NotificationCenter({ className }: { className?: string }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NotificationResponse>({
    notifications: [],
    unreadCount: 0,
  });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const json = await response.json();
      if (response.ok && json.data) {
        setData(json.data as NotificationResponse);
      }
    } catch {
      // The header must stay usable if notification loading fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => void load(), 60_000);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(key: string) {
    setData((current) => ({
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
  }

  async function markAllRead() {
    const keys = data.notifications.filter((item) => !item.read).map((item) => item.key);
    if (keys.length === 0) return;
    setData((current) => ({
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
      unreadCount: 0,
    }));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read", keys }),
    }).catch(() => {});
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${data.unreadCount} notification${data.unreadCount > 1 ? "s" : ""} non lue${data.unreadCount > 1 ? "s" : ""}`}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--surface)] sm:size-10",
          open && "border-[var(--primary)]/45 ring-2 ring-[var(--primary)]/15",
        )}
      >
        {loading ? (
          <LoaderCircle className="size-4 animate-spin text-[var(--muted-foreground)]" />
        ) : (
          <Bell className="size-4.5" />
        )}
        {data.unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.55rem] font-bold leading-none text-white ring-2 ring-[var(--surface)] sm:min-h-5 sm:min-w-5 sm:text-[0.62rem]">
            {data.unreadCount > 99 ? "99+" : data.unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Centre de notifications"
          className="fixed inset-x-3 top-[4.2rem] z-[70] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-floating)] sm:left-auto sm:right-3 sm:w-[24rem] lg:absolute lg:right-0 lg:top-full lg:mt-2"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--foreground)]">Notifications</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.unreadCount > 0
                  ? `${data.unreadCount} priorité${data.unreadCount > 1 ? "s" : ""} à consulter`
                  : "Vous êtes à jour"}
              </p>
            </div>
            {data.unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
              >
                <CheckCheck className="size-4" />
                Tout lire
              </button>
            ) : null}
          </div>

          <div className="sidebar-scroll max-h-[min(70vh,34rem)] overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-[var(--muted-foreground)]">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Chargement…
              </div>
            ) : data.notifications.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                  <CheckCheck className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">Aucune alerte prioritaire</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Les impayés, échéances et séances à finaliser apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {data.notifications.map((notification) => (
                  <NotificationItem
                    key={notification.key}
                    notification={notification}
                    onOpen={() => {
                      void markRead(notification.key);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationItem({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const Icon =
    notification.kind === "PAYMENT_DUE"
      ? CircleDollarSign
      : notification.kind === "SESSION_FINALIZATION"
        ? ClipboardCheck
        : CalendarClock;
  const style = severityStyles[notification.severity];

  return (
    <li>
      <Link
        href={notification.href}
        onClick={onOpen}
        className={cn(
          "group flex min-h-[4.75rem] items-start gap-3 rounded-lg border px-3 py-3 transition",
          notification.read
            ? "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
            : "border-[var(--primary)]/15 bg-[var(--primary)]/[0.045] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/[0.075]",
        )}
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", style.icon)}>
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--foreground)]">
              {notification.title}
            </span>
            {!notification.read ? (
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)} />
            ) : null}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-[var(--muted-foreground)]">
            {notification.description}
          </span>
        </span>
      </Link>
    </li>
  );
}
