"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  Dumbbell,
  Import,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const dailySection: NavSection = {
  title: "Accueil",
  items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/attendance/today", label: "Pointage", icon: Clock },
    { href: "/enrollment", label: "Inscrire", icon: UserPlus },
    { href: "/payments/new", label: "Encaisser", icon: Banknote },
    { href: "/sessions", label: "Planning", icon: CalendarRange },
  ],
};

export const membersSection: NavSection = {
  title: "Membres",
  items: [
    { href: "/members", label: "Membres", icon: Users },
    { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
  ],
};

export const cashSection: NavSection = {
  title: "Suivi",
  items: [
    { href: "/payments", label: "Paiements", icon: Wallet },
    { href: "/attendance", label: "Présences", icon: Activity },
    { href: "/attendance/groups", label: "Rapports groupes", icon: ClipboardCheck },
  ],
};

export const clubConfigSection: NavSection = {
  title: "Configuration",
  items: [
    { href: "/settings/club", label: "Club", icon: SlidersHorizontal },
    { href: "/sports", label: "Disciplines", icon: Dumbbell },
    { href: "/coaches", label: "Coachs", icon: User },
    { href: "/groups", label: "Cours", icon: CalendarDays },
    { href: "/subscription-plans", label: "Formules", icon: ClipboardCheck },
    { href: "/offers", label: "Offres", icon: CreditCard },
    { href: "/settings/data-import", label: "Reprise", icon: Import },
  ],
};

export const adminSection: NavSection = {
  title: "Administration",
  items: [
    { href: "/settings/users", label: "Utilisateurs", icon: Users, adminOnly: true },
    { href: "/logs", label: "Journal actions", icon: ShieldCheck, adminOnly: true },
  ],
};

/** @deprecated Use clubConfigSection */
export const settingsSection = clubConfigSection;

export const navSections: NavSection[] = [dailySection, membersSection, cashSection];

export function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/attendance") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/attendance/today") &&
        !pathname.startsWith("/attendance/groups"))
    );
  }
  if (href === "/payments") {
    return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/payments/new"));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function useAccountRole() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok) return;
        const account = (await response.json()) as { data?: { role?: string }; role?: string };
        if (!cancelled) setRole(account.data?.role ?? account.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}

export function getConfigurationSections(role: string | null) {
  return role === "ADMIN" ? [clubConfigSection, adminSection] : [clubConfigSection];
}

export function NavLink({
  item,
  pathname,
  onClick,
  collapsed = false,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const active = isLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-lg py-2 text-[0.82rem] font-medium transition-all",
        collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)] shadow-[var(--shadow-panel)] ring-1 ring-[var(--primary)]/20"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-[var(--primary)]" : "opacity-60")} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const [configOpen, setConfigOpen] = useState(false);
  const role = useAccountRole();
  const configurationSections = getConfigurationSections(role);

  const inClubConfig = configurationSections.some((section) =>
    section.items.some((item) => isLinkActive(pathname, item.href)),
  );

  return (
    <aside className="sidebar-scroll hidden border-b border-[var(--border)] bg-[var(--surface)]/96 backdrop-blur lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:overscroll-y-contain lg:border-r lg:border-b-0">
      <div
        className={cn(
          "border-b border-[var(--border)] py-3",
          collapsed ? "flex flex-col items-center gap-2 px-2" : "flex items-center justify-between px-3 lg:px-4",
        )}
      >
        <Link
          href="/"
          className={cn("min-w-0 rounded-lg transition hover:bg-[var(--surface-soft)]", collapsed ? "flex-none" : "flex-1")}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
            <ClubBrandMark size="md" compact={collapsed} />
          </div>
        </Link>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] lg:inline-flex"
            title={collapsed ? "Développer le menu" : "Réduire le menu"}
            aria-label={collapsed ? "Développer le menu" : "Réduire le menu"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        ) : null}
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-2 lg:py-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            {!collapsed ? (
              <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] lg:block">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        ))}

        <div className="mb-1 mt-2 border-t border-[var(--border)] pt-2 lg:mt-3 lg:pt-3">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            aria-expanded={configOpen || inClubConfig}
            aria-label={collapsed ? clubConfigSection.title : undefined}
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-[0.82rem] font-medium transition-all lg:mb-1",
              collapsed ? "justify-center px-2" : "justify-between px-3",
              inClubConfig || configOpen
                ? "text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
            )}
            title={collapsed ? clubConfigSection.title : undefined}
          >
            {collapsed ? (
              <SlidersHorizontal className="size-[1.1rem] shrink-0 opacity-60" />
            ) : (
              <>
                <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.16em] lg:block">
                  {clubConfigSection.title}
                </span>
                <span className="lg:hidden">{clubConfigSection.title}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 transition-transform", configOpen || inClubConfig ? "rotate-180" : "")}
                />
              </>
            )}
          </button>

          {(configOpen || inClubConfig) && (
            <div className="lg:space-y-0.5">
              {configurationSections.map((section, sectionIndex) => (
                <div
                  key={section.title}
                  className={cn(sectionIndex > 0 && "mt-2 border-t border-[var(--border)] pt-2")}
                >
                  {!collapsed && sectionIndex > 0 ? (
                    <p className="mb-1 px-3 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      {section.title}
                    </p>
                  ) : null}
                  {section.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
