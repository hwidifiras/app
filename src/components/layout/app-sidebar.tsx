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
import { useClubBranding } from "@/components/layout/club-branding-provider";
import { hasPermission, type PermissionKey } from "@/lib/permission-definitions";
import { cn } from "@/lib/utils";
import type { ProductModule } from "@/platform/product/product-context";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  moduleKey?: ProductModule;
  permission?: PermissionKey;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const dailySection: NavSection = {
  title: "Aujourd'hui",
  items: [
    { href: "/", label: "Accueil", icon: LayoutDashboard },
    { href: "/attendance/today", label: "Pointage", icon: Clock, moduleKey: "CLASS_MANAGEMENT", permission: "class.attendance" },
    { href: "/sessions", label: "Planning", icon: CalendarRange, moduleKey: "CLASS_MANAGEMENT", permission: "class.attendance" },
    { href: "/gym/check-in", label: "Accès salle", icon: Dumbbell, moduleKey: "GYM_ACCESS", permission: "gym.checkin" },
  ],
};

export const salesSection: NavSection = {
  title: "Ventes",
  items: [
    { href: "/enrollment", label: "Inscrire", icon: UserPlus, permission: "enrollment.sell" },
    { href: "/payments/new", label: "Encaisser", icon: Banknote, permission: "payments.collect" },
    { href: "/subscriptions", label: "Abonnements", icon: CreditCard, permission: "enrollment.sell" },
    { href: "/payments", label: "Historique caisse", icon: Wallet, permission: "reports.finance" },
  ],
};

export const studentsSection: NavSection = {
  title: "Élèves",
  items: [
    { href: "/members", label: "Membres", icon: Users, permission: "members.manage" },
    { href: "/attendance", label: "Historique présences", icon: Activity, moduleKey: "CLASS_MANAGEMENT", permission: "class.attendance" },
    { href: "/attendance/groups", label: "Suivi groupes", icon: ClipboardCheck, moduleKey: "CLASS_MANAGEMENT", permission: "class.attendance" },
    { href: "/gym/visits", label: "Historique accès", icon: Dumbbell, moduleKey: "GYM_ACCESS", permission: "gym.manage" },
  ],
};

export const clubSection: NavSection = {
  title: "Club",
  items: [
    { href: "/groups", label: "Groupes & horaires", icon: CalendarDays, moduleKey: "CLASS_MANAGEMENT", permission: "class.manage" },
    { href: "/coaches", label: "Coachs", icon: User, moduleKey: "CLASS_MANAGEMENT", permission: "class.manage" },
    { href: "/sports", label: "Disciplines", icon: Dumbbell, moduleKey: "CLASS_MANAGEMENT", permission: "class.manage" },
  ],
};

export const settingsSection: NavSection = {
  title: "Réglages",
  items: [
    { href: "/settings", label: "Vue d'ensemble", icon: Settings, permission: "settings.manage" },
    { href: "/settings/club", label: "Club", icon: Building2, permission: "settings.manage" },
    { href: "/settings/schedules", label: "Horaires & saisons", icon: CalendarClock, moduleKey: "CLASS_MANAGEMENT", permission: "settings.manage" },
    { href: "/subscription-plans", label: "Formules", icon: ClipboardCheck, permission: "plans.manage" },
    { href: "/offers", label: "Offres", icon: CreditCard, permission: "plans.manage" },
    { href: "/settings/data-import", label: "Import ancien fichier", icon: Import, moduleKey: "CLASS_MANAGEMENT", permission: "settings.manage" },
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

export function navItemIsVisible(
  item: NavItem,
  account: { role: string; permissions: string[]; modules: string[]; operationsAllowed?: boolean } | null,
) {
  if (!account) return false;
  if (account.operationsAllowed === false && item.href !== "/settings/account") return false;
  if (item.adminOnly && account.role !== "ADMIN") return false;
  if (item.moduleKey && !account.modules.includes(item.moduleKey)) return false;
  if (item.permission && account.role !== "ADMIN" && !hasPermission(account.permissions, item.permission)) return false;
  return true;
}

export function getConfigurationSections(
  role: string | null,
  account?: { role: string; permissions: string[]; modules: string[]; operationsAllowed?: boolean } | null,
) {
  const sections = [
    settingsSection,
    ...(role === "ADMIN" ? [adminSection] : []),
    ...(role === "ADMIN" ? [] : [accountSettingsSection]),
  ];
  if (!account) return [];
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => navItemIsVisible(item, account)) }))
    .filter((section) => section.items.length > 0);
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
      title={item.label}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center rounded-lg py-2 text-[0.8rem] font-semibold transition-all",
        collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        active
          ? "bg-[var(--primary)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] ring-1 ring-white/15"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-white" : "opacity-70")} />
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
  const { appName } = useClubBranding();
  const role = account?.role ?? null;
  const configurationSections = getConfigurationSections(role, account);
  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navItemIsVisible(item, account)),
    }))
    .filter((section) => section.items.length > 0);

  const inClubConfig = configurationSections.some((section) =>
    section.items.some((item) => isLinkActive(pathname, item.href)),
  );

  return (
    <aside
      data-app-sidebar
      className="app-sidebar-theme sidebar-scroll hidden border-b border-[var(--border)] bg-[var(--surface)] print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:overscroll-y-contain lg:border-r lg:border-b-0"
    >
      <div
        className={cn(
          "min-h-[var(--app-topbar-height)] border-b border-[var(--border)] py-3",
          collapsed ? "flex flex-col items-center gap-2 px-2" : "flex items-center px-3 lg:px-4",
        )}
      >
        <Link
          href="/"
          aria-label={`${appName} · Accueil`}
          className={cn("min-w-0 rounded-lg transition hover:bg-[var(--surface-soft)]", collapsed ? "flex-none" : "flex-1")}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
            <ClubBrandMark size="md" compact={collapsed} />
          </div>
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="flex flex-1 gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-2 lg:py-3">
        {visibleNavSections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed ? (
              <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] lg:block">
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

        {configurationSections.length > 0 ? (
          <div className="mb-1 mt-2 border-t border-[var(--border)] pt-2 lg:mt-4 lg:pt-3">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            aria-expanded={configOpen || inClubConfig}
            aria-label={collapsed ? settingsSection.title : undefined}
            className={cn(
              "flex min-h-11 w-full items-center rounded-lg py-2 text-[0.8rem] font-medium transition-all lg:mb-1",
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
        ) : null}
      </nav>

      <div className={cn("mt-auto border-t border-[var(--border)] px-3 py-3", collapsed && "px-2")}>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)] lg:inline-flex",
              collapsed && "px-0",
            )}
            title={collapsed ? "Développer le menu" : "Réduire le menu"}
            aria-label={collapsed ? "Développer le menu" : "Réduire le menu"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            {!collapsed ? <span>Réduire</span> : null}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
