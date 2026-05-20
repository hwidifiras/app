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
  SlidersHorizontal,
} from "lucide-react";

import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/* ── Section 1: Actions quotidiennes (haute fréquence) ── */
export const dailySection: NavSection = {
  title: "Accueil",
  items: [
    { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/attendance/today", label: "Pointer du jour", icon: Clock },
    { href: "/enrollment", label: "Inscription", icon: UserPlus },
    { href: "/payments/new", label: "Encaisser", icon: Banknote },
    { href: "/sessions", label: "Planning semaine", icon: CalendarRange },
  ],
};

/* ── Section 2: Gestion adhérents (hebdomadaire) ── */
export const membersSection: NavSection = {
  title: "Adhérents",
  items: [
    { href: "/members", label: "Élèves", icon: Users },
    { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
  ],
};

/* ── Section 3: Caisse & Suivi (hebdomadaire) ── */
export const cashSection: NavSection = {
  title: "Caisse & Suivi",
  items: [
    { href: "/payments", label: "Paiements reçus", icon: Wallet },
    { href: "/attendance", label: "Historique présences", icon: Activity },
    { href: "/attendance/groups", label: "Présences par groupe", icon: ClipboardCheck },
  ],
};

/* ── Section 4: Configuration club (basse fréquence, masquable) ── */
export const clubConfigSection: NavSection = {
  title: "Configuration",
  items: [
    { href: "/settings/club", label: "Règles du club", icon: SlidersHorizontal },
    { href: "/sports", label: "Disciplines", icon: Dumbbell },
    { href: "/coaches", label: "Coachs", icon: User },
    { href: "/groups", label: "Cours & créneaux", icon: CalendarDays },
    { href: "/subscription-plans", label: "Formules & tarifs", icon: ClipboardCheck },
    { href: "/offers", label: "Offres", icon: CreditCard },
  ],
};

/** @deprecated Use clubConfigSection */
export const settingsSection = clubConfigSection;

export const navSections: NavSection[] = [dailySection, membersSection, cashSection];

function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const active = isLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
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
}

export function AppSidebar() {
  const pathname = usePathname();
  const [configOpen, setConfigOpen] = useState(false);

  const inClubConfig = clubConfigSection.items.some((i) => isLinkActive(pathname, i.href));

  return (
    <aside className="sidebar-scroll hidden border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:sticky lg:block lg:top-0 lg:h-screen lg:overflow-y-auto lg:overscroll-y-contain lg:border-r lg:border-b-0">
      <Link href="/" className="block border-b border-[var(--border)] px-4 py-4 lg:px-5">
        <div className="flex items-center gap-3 rounded-xl transition hover:bg-[var(--surface-soft)]">
          <ClubBrandMark size="md" />
        </div>
      </Link>

      <nav className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60 lg:block">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}

        {/* ── Configuration club (pliable) ── */}
        <div className="mb-1 mt-2 border-t border-[var(--border)] pt-2 lg:mt-3 lg:pt-3">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all lg:mb-1",
              inClubConfig || configOpen
                ? "text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
            )}
          >
            <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60 lg:block">
              {clubConfigSection.title}
            </span>
            <span className="lg:hidden">{clubConfigSection.title}</span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform",
                configOpen || inClubConfig ? "rotate-180" : "",
              )}
            />
          </button>

          {(configOpen || inClubConfig) && (
            <div className="lg:space-y-0.5">
              {clubConfigSection.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
