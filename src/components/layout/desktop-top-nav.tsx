"use client";

import { usePathname } from "next/navigation";

import { DisplayModeToggle } from "@/components/layout/display-mode-toggle";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import { UserAccountMenu } from "@/components/layout/user-account-menu";

const pageLabels: Array<{ prefix: string; label: string }> = [
  { prefix: "/attendance/today", label: "Pointage du jour" },
  { prefix: "/attendance", label: "Présences" },
  { prefix: "/enrollment", label: "Inscription" },
  { prefix: "/payments/new", label: "Encaissement" },
  { prefix: "/payments", label: "Paiements" },
  { prefix: "/members", label: "Membres" },
  { prefix: "/sessions", label: "Planning" },
  { prefix: "/subscriptions", label: "Abonnements" },
  { prefix: "/groups", label: "Cours et créneaux" },
  { prefix: "/settings", label: "Paramètres" },
];

export function DesktopTopNav() {
  const pathname = usePathname();
  const pageLabel =
    pathname === "/"
      ? "Tableau de bord"
      : pageLabels.find((item) => pathname.startsWith(item.prefix))?.label ?? "Gestion du club";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:block">
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
        <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
