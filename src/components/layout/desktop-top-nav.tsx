"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";

import { AppRefreshButton } from "@/components/layout/app-refresh-button";
import { dailySection, navItemIsVisible } from "@/components/layout/app-sidebar";
import { useAppShellData } from "@/components/layout/app-shell-data-provider";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import { getAppTimeZone, utcDateOnlyForTimeZone, weekStartIsoForDate } from "@/lib/dates";

const pageLabels: Array<{ prefix: string; label: string }> = [
  { prefix: "/attendance/today", label: "Pointage" },
  { prefix: "/attendance/groups", label: "Suivi groupes" },
  { prefix: "/attendance", label: "Historique présences" },
  { prefix: "/enrollment", label: "Inscrire" },
  { prefix: "/payments/new", label: "Encaisser" },
  { prefix: "/payments", label: "Historique caisse" },
  { prefix: "/members", label: "Membres" },
  { prefix: "/sessions", label: "Planning" },
  { prefix: "/gym/check-in", label: "Accès salle" },
  { prefix: "/gym/visits", label: "Historique accès" },
  { prefix: "/gym/import", label: "Import salle" },
  { prefix: "/subscriptions", label: "Abonnements" },
  { prefix: "/subscription-plans", label: "Formules" },
  { prefix: "/sports", label: "Disciplines" },
  { prefix: "/coaches", label: "Coachs" },
  { prefix: "/groups", label: "Groupes & horaires" },
  { prefix: "/offers", label: "Offres" },
  { prefix: "/logs", label: "Journal actions" },
  { prefix: "/receipts", label: "Reçu" },
  { prefix: "/onboarding", label: "Guide de démarrage" },
  { prefix: "/subscription-status", label: "Abonnement SaaS" },
  { prefix: "/settings/users", label: "Utilisateurs" },
  { prefix: "/settings/schedules", label: "Horaires & saisons" },
  { prefix: "/settings/data-import", label: "Import ancien fichier" },
  { prefix: "/settings/club", label: "Paramètres du club" },
  { prefix: "/settings/account", label: "Mon compte" },
  { prefix: "/settings", label: "Réglages" },
];

function isoWeekNumber(date: Date) {
  const clubDate = utcDateOnlyForTimeZone(date);
  const thursday = new Date(clubDate);
  const weekday = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function commandDateLabel(date: Date) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: getAppTimeZone(),
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DesktopTopNav() {
  const pathname = usePathname();
  const { account } = useAppShellData();
  const now = new Date();
  const today = utcDateOnlyForTimeZone(now);
  const weekStart = weekStartIsoForDate(now);
  const planningItem = dailySection.items.find((item) => item.href === "/sessions");
  const canOpenPlanning = planningItem ? navItemIsVisible(planningItem, account) : false;
  const pageLabel =
    pathname === "/" ? "Réception" : pageLabels.find((item) => pathname.startsWith(item.prefix))?.label ?? "Gestion";

  return (
    <header
      data-app-top-nav
      className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/96 backdrop-blur print:hidden lg:block"
    >
      <div className="grid min-h-[var(--app-topbar-height)] grid-cols-[minmax(8rem,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-5 py-2 xl:px-6">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-[-0.025em] text-[var(--foreground)]">{pageLabel}</p>
        </div>

        <div className="flex items-center divide-x divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-panel)]">
          {canOpenPlanning ? (
            <Link
              href={`/sessions?week=${weekStart}`}
              prefetch={false}
              className="flex min-h-11 items-center gap-2 rounded-l-lg px-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
              title="Ouvrir le planning de cette semaine"
            >
              <CalendarDays className="size-4.5 shrink-0 text-[var(--primary)]" aria-hidden />
              <time dateTime={today.toISOString().slice(0, 10)} suppressHydrationWarning className="whitespace-nowrap">
                {commandDateLabel(now)}
              </time>
              <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
            </Link>
          ) : (
            <div className="flex min-h-11 items-center gap-2 rounded-l-lg px-3 text-sm font-semibold text-[var(--foreground)]">
              <CalendarDays className="size-4.5 shrink-0 text-[var(--primary)]" aria-hidden />
              <time dateTime={today.toISOString().slice(0, 10)} suppressHydrationWarning className="whitespace-nowrap">
                {commandDateLabel(now)}
              </time>
            </div>
          )}
          <span className="hidden min-h-11 items-center px-3 text-sm font-semibold text-[var(--muted-foreground)] xl:inline-flex">
            Semaine {isoWeekNumber(now)}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <SetupGuide variant="header" className="hidden 2xl:block" />
          <AppRefreshButton className="!size-11" />
          <NotificationCenter showLabel />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
