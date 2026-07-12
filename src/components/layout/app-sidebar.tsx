"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Building2,
  CalendarDays,
  CalendarClock,
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
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { useAppShellData, type NavigationBadge } from "@/components/layout/app-shell-data-provider";
import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  moduleKey?: "GYM";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const dailySection: NavSection = {
  title: "Aujourd'hui",
  items: [
    { href: "/", label: "Accueil", icon: LayoutDashboard },
    { href: "/attendance/today", label: "Pointage", icon: Clock },
    { href: "/sessions", label: "Planning", icon: CalendarRange },
    { href: "/gym/check-in", label: "Acces salle", icon: Dumbbell, moduleKey: "GYM" },
  ],
};

export const salesSection: NavSection = {
  title: "Ventes",
  items: [
    { href: "/enrollment", label: "Inscrire", icon: UserPlus },
    { href: "/payments/new", label: "Encaisser", icon: Banknote },
    { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
    { href: "/payments", label: "Historique caisse", icon: Wallet },
  ],
};

export const studentsSection: NavSection = {
  title: "Élèves",
  items: [
    { href: "/members", label: "Membres", icon: Users },
    { href: "/attendance", label: "Historique présences", icon: Activity },
    { href: "/attendance/groups", label: "Suivi groupes", icon: ClipboardCheck },
  ],
};

export const clubSection: NavSection = {
  title: "Club",
  items: [
    { href: "/groups", label: "Groupes & horaires", icon: CalendarDays },
    { href: "/coaches", label: "Coachs", icon: User },
    { href: "/sports", label: "Disciplines", icon: Dumbbell },
  ],
};

export const settingsSection: NavSection = {
  title: "Réglages",
  items: [
    { href: "/settings", label: "Vue d'ensemble", icon: Settings },
    { href: "/settings/club", label: "Club", icon: Building2 },
    { href: "/settings/schedules", label: "Horaires & saisons", icon: CalendarClock },
    { href: "/subscription-plans", label: "Formules", icon: ClipboardCheck },
    { href: "/offers", label: "Offres", icon: CreditCard },
    { href: "/settings/data-import", label: "Import ancien fichier", icon: Import },
  ],
};

export const adminSection: NavSection = {
  title: "Administration",
  items: [
    { href: "/settings/users", label: "Utilisateurs", icon: Users, adminOnly: true },
    { href: "/logs", label: "Journal actions", icon: ShieldCheck, adminOnly: true },
  ],
};

export const accountSettingsSection: NavSection = {
  title: "Réglages",
  items: [{ href: "/settings/account", label: "Mon compte", icon: User }],
};

export const clubConfigSection: NavSection = {
  title: "Configuration",
  items: [...clubSection.items, ...settingsSection.items],
};

/** @deprecated Use studentsSection */
export const membersSection = studentsSection;

/** @deprecated Use salesSection */
export const cashSection = salesSection;

export const navSections: NavSection[] = [dailySection, salesSection, studentsSection, clubSection];

export function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/settings") return pathname === "/settings";
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

export function getConfigurationSections(role: string | null) {
  return role === "ADMIN" ? [settingsSection, adminSection] : [accountSettingsSection];
}

export function NavLink({
  item,
  pathname,
  onClick,
  collapsed = false,
  badge,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
  collapsed?: boolean;
  badge?: NavigationBadge | null;
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
        "relative flex items-center rounded-lg py-2 text-[0.82rem] font-medium transition-all",
        collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)] shadow-[var(--shadow-panel)] ring-1 ring-[var(--primary)]/20"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-[var(--primary)]" : "opacity-60")} />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      {badge ? <NavBadge badge={badge} collapsed={collapsed} /> : null}
    </Link>
  );
}

function NavBadge({ badge, collapsed = false }: { badge: NavigationBadge; collapsed?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[0.62rem] font-black leading-5 tabular-nums",
        collapsed && "absolute right-0 top-0 min-w-4 px-1 text-[0.55rem] leading-4 ring-2 ring-[var(--surface)]",
        badge.tone === "red" && "bg-[var(--danger)]/12 text-[var(--danger)]",
        badge.tone === "amber" && "bg-[var(--warning)]/14 text-[var(--warning)]",
        badge.tone === "blue" && "bg-[var(--primary)]/12 text-[var(--primary)]",
      )}
    >
      {badge.label}
    </span>
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
  const { account, navBadges } = useAppShellData();
  const role = account?.role ?? null;
  const enabledModules = new Set(account?.modules ?? []);
  const configurationSections = getConfigurationSections(role);

  const inClubConfig = configurationSections.some((section) =>
    section.items.some((item) => isLinkActive(pathname, item.href)),
  );

  return (
    <aside
      data-app-sidebar
      className="sidebar-scroll hidden border-b border-[var(--border)] bg-[var(--surface)]/96 backdrop-blur print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:overscroll-y-contain lg:border-r lg:border-b-0"
    >
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

      <nav className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-2 lg:py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed ? (
              <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] lg:block">
                {section.title}
              </p>
            ) : null}
            {section.items.filter((item) => !item.moduleKey || enabledModules.has(item.moduleKey)).map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                badge={navBadges[item.href]}
              />
            ))}
          </div>
        ))}

        <div className="mb-1 mt-2 border-t border-[var(--border)] pt-2 lg:mt-5 lg:pt-4">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            aria-expanded={configOpen || inClubConfig}
            aria-label={collapsed ? settingsSection.title : undefined}
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-[0.82rem] font-medium transition-all lg:mb-1",
              collapsed ? "justify-center px-2" : "justify-between px-3",
              inClubConfig || configOpen
                ? "text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
            )}
            title={collapsed ? settingsSection.title : undefined}
          >
            {collapsed ? (
              <Settings className="size-[1.1rem] shrink-0 opacity-60" />
            ) : (
              <>
                <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.16em] lg:block">
                  {settingsSection.title}
                </span>
                <span className="lg:hidden">{settingsSection.title}</span>
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
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                      badge={navBadges[item.href]}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className={cn("mt-auto border-t border-[var(--border)] px-4 py-4", collapsed && "px-2 py-3")}>
        {collapsed ? (
          <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/we-discipline/navbar-logo.png" alt="We Discipline" className="h-4 w-10 object-contain opacity-45" />
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Propulsé par
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/we-discipline/navbar-logo.png" alt="We Discipline" className="mt-1 h-7 w-auto opacity-70" />
          </div>
        )}
      </div>
    </aside>
  );
}
