"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  LoaderCircle,
  X,
} from "lucide-react";

import { useAppShellData } from "@/components/layout/app-shell-data-provider";
import type { AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

const severityStyles = {
  critical: {
    icon: "bg-red-500/12 text-red-600 dark:text-red-300",
    dot: "bg-red-500",
    label: "Urgent",
    heading: "text-red-700 dark:text-red-300",
    count: "bg-red-500/12 text-red-700 dark:text-red-300",
  },
  warning: {
    icon: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "À faire",
    heading: "text-amber-800 dark:text-amber-300",
    count: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
  },
  info: {
    icon: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    dot: "bg-sky-500",
    label: "À surveiller",
    heading: "text-sky-700 dark:text-sky-300",
    count: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
} as const;

export function NotificationCenter({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelId = `${titleId}-panel`;
  const {
    notifications,
    unreadCount,
    notificationsLoading: loading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppShellData();
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    lockScroll: false,
  });
  const groups = (["critical", "warning", "info"] as const)
    .map((severity) => ({
      severity,
      items: notifications.filter((notification) => notification.severity === severity),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function markRead(key: string) {
    await markNotificationRead(key);
  }

  async function markAllRead() {
    await markAllNotificationsRead();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-label={`${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--surface)]",
          open && "border-[var(--primary)]/45 ring-2 ring-[var(--primary)]/15",
        )}
      >
        {loading ? (
          <LoaderCircle className="size-4 animate-spin text-[var(--muted-foreground)]" />
        ) : (
          <Bell className="size-4.5" />
        )}
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.55rem] font-bold leading-none text-white ring-2 ring-[var(--surface)] sm:min-h-5 sm:min-w-5 sm:text-[0.62rem]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={dialogRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed inset-x-3 top-[4.2rem] z-[70] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-floating)] sm:left-auto sm:right-3 sm:w-[24rem] lg:absolute lg:right-0 lg:top-full lg:mt-2"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <p id={titleId} className="font-semibold text-[var(--foreground)]">Alertes</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {unreadCount > 0
                  ? `${unreadCount} alerte${unreadCount > 1 ? "s" : ""} non consultée${unreadCount > 1 ? "s" : ""}`
                  : "Vous êtes à jour"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
                >
                  <CheckCheck className="size-4" />
                  Marquer comme lues
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                aria-label="Fermer les alertes"
              >
                <X className="size-4.5" />
              </button>
            </div>
          </div>

          <div className="sidebar-scroll max-h-[min(70vh,34rem)] overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-[var(--muted-foreground)]">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Chargement…
              </div>
            ) : notifications.length === 0 ? (
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
              <div className="space-y-3">
                {groups.map((group) => {
                  const style = severityStyles[group.severity];
                  const headingId = `${titleId}-group-${group.severity}`;
                  return (
                    <section key={group.severity} aria-labelledby={headingId}>
                      <div className="flex items-center justify-between gap-2 px-2 py-1">
                        <h3 id={headingId} className={cn("text-[0.68rem] font-bold uppercase tracking-[0.14em]", style.heading)}>
                          {style.label}
                        </h3>
                        <span className={cn("inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold", style.count)}>
                          {group.items.length}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {group.items.map((notification) => (
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
                    </section>
                  );
                })}
              </div>
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
        prefetch={false}
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
