"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  User,
  CalendarDays,
  CalendarRange,
  CreditCard,
  ClipboardCheck,
  Wallet,
  Activity,
  Clock,
  UserPlus,
  Banknote,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

/* ── Section 1: Actions quotidiennes (haute fréquence) ── */
const dailySection: NavSection = {
  title: "Accueil",
  items: [
    { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/attendance/today", label: "Pointer du jour", icon: Clock },
    { href: "/members/new", label: "Nouvelle inscription", icon: UserPlus },
    { href: "/payments/new", label: "Encaisser", icon: Banknote },
    { href: "/sessions", label: "Planning semaine", icon: CalendarRange },
  ],
};

/* ── Section 2: Gestion adhérents (hebdomadaire) ── */
const membersSection: NavSection = {
  title: "Adhérents",
  items: [
    { href: "/members", label: "Liste des membres", icon: Users },
    { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
  ],
};

/* ── Section 3: Caisse & Suivi (hebdomadaire) ── */
const cashSection: NavSection = {
  title: "Caisse & Suivi",
  items: [
    { href: "/payments", label: "Paiements reçus", icon: Wallet },
    { href: "/attendance", label: "Historique présences", icon: Activity },
  ],
};

/* ── Section 4: Configuration (basse fréquence, masquable) ── */
const settingsSection: NavSection = {
  title: "Paramètres",
  items: [
    { href: "/sports", label: "Sports", icon: Dumbbell },
    { href: "/coaches", label: "Coachs", icon: User },
    { href: "/groups", label: "Groupes & créneaux", icon: CalendarDays },
    { href: "/subscription-plans", label: "Plans & tarifs", icon: ClipboardCheck },
  ],
};

const navSections: NavSection[] = [dailySection, membersSection, cashSection];

export function AppSidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const inSettings = settingsSection.items.some((i) => isActive(i.href));

  return (
    <aside className="border-b border-[var(--border)] bg-white/90 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4 lg:px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
          <Dumbbell className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">GYM SaaS</p>
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
            Réception
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60 lg:block">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all",
                    active
                      ? "bg-[var(--primary)]/8 text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/15"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-[var(--primary)]" : "opacity-60")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {/* ── Paramètres (pliable) ── */}
        <div className="mb-1 mt-2 border-t border-[var(--border)] pt-2 lg:mt-3 lg:pt-3">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all lg:mb-1",
              inSettings || settingsOpen
                ? "text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
            )}
          >
            <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60 lg:block">
              Paramètres
            </span>
            <span className="lg:hidden">Paramètres</span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform",
                settingsOpen || inSettings ? "rotate-180" : "",
              )}
            />
          </button>

          {(settingsOpen || inSettings) && (
            <div className="lg:space-y-0.5">
              {settingsSection.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all",
                      active
                        ? "bg-[var(--primary)]/8 text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/15"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-[var(--primary)]" : "opacity-60")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
