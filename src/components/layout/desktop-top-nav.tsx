"use client";

import { usePathname } from "next/navigation";

import { DisplayModeToggle } from "@/components/layout/display-mode-toggle";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SetupGuide } from "@/components/onboarding/setup-guide";

const pageLabels: Array<{ prefix: string; label: string }> = [
  { prefix: "/attendance/today", label: "Pointage" },
  { prefix: "/attendance/groups", label: "Rapports groupes" },
  { prefix: "/attendance", label: "Présences" },
  { prefix: "/enrollment", label: "Inscrire" },
  { prefix: "/payments/new", label: "Encaisser" },
  { prefix: "/payments", label: "Paiements" },
  { prefix: "/members", label: "Membres" },
  { prefix: "/sessions", label: "Planning" },
  { prefix: "/subscriptions", label: "Abonnements" },
  { prefix: "/subscription-plans", label: "Formules" },
  { prefix: "/sports", label: "Disciplines" },
  { prefix: "/coaches", label: "Coachs" },
  { prefix: "/groups", label: "Cours" },
  { prefix: "/offers", label: "Offres" },
  { prefix: "/logs", label: "Journal actions" },
  { prefix: "/settings/users", label: "Utilisateurs" },
  { prefix: "/settings/data-import", label: "Reprise" },
  { prefix: "/settings", label: "Paramètres" },
];

export function DesktopTopNav() {
  const pathname = usePathname();
  const pageLabel =
    pathname === "/" ? "Dashboard" : pageLabels.find((item) => pathname.startsWith(item.prefix))?.label ?? "Gestion";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/96 backdrop-blur lg:block">
      <div className="flex min-h-[3.5rem] items-center justify-between gap-4 px-5 py-2">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Espace réception
          </p>
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{pageLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <DisplayModeToggle />
          <SetupGuide variant="header" />
          <NotificationCenter />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
