"use client";

import { usePathname } from "next/navigation";

import { DisplayModeToggle } from "@/components/layout/display-mode-toggle";
import { AppRefreshButton } from "@/components/layout/app-refresh-button";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SetupGuide } from "@/components/onboarding/setup-guide";

const pageLabels: Array<{ prefix: string; label: string }> = [
  { prefix: "/attendance/today", label: "Pointage" },
  { prefix: "/attendance/groups", label: "Suivi groupes" },
  { prefix: "/attendance", label: "Historique présences" },
  { prefix: "/enrollment", label: "Inscrire" },
  { prefix: "/payments/new", label: "Encaisser" },
  { prefix: "/payments", label: "Historique caisse" },
  { prefix: "/members", label: "Membres" },
  { prefix: "/sessions", label: "Planning" },
  { prefix: "/subscriptions", label: "Abonnements" },
  { prefix: "/subscription-plans", label: "Formules" },
  { prefix: "/sports", label: "Disciplines" },
  { prefix: "/coaches", label: "Coachs" },
  { prefix: "/groups", label: "Groupes & horaires" },
  { prefix: "/offers", label: "Offres" },
  { prefix: "/logs", label: "Journal actions" },
  { prefix: "/settings/users", label: "Utilisateurs" },
  { prefix: "/settings/schedules", label: "Horaires & saisons" },
  { prefix: "/settings/data-import", label: "Import ancien fichier" },
  { prefix: "/settings", label: "Réglages" },
];

export function DesktopTopNav() {
  const pathname = usePathname();
  const pageLabel =
    pathname === "/" ? "Accueil" : pageLabels.find((item) => pathname.startsWith(item.prefix))?.label ?? "Gestion";

  return (
    <header
      data-app-top-nav
      className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/96 backdrop-blur print:hidden lg:block"
    >
      <div className="flex min-h-[var(--app-topbar-height)] items-center justify-between gap-4 px-6 py-2">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Espace réception
          </p>
          <p className="mt-0.5 truncate text-xl font-bold tracking-[-0.02em] text-[var(--foreground)]">{pageLabel}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <DisplayModeToggle />
          <SetupGuide variant="header" />
          <AppRefreshButton />
          <NotificationCenter />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
