"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, ChevronDown, Clock, Dumbbell, Home, Menu, PlusCircle, Search, X } from "lucide-react";

import {
  getConfigurationSections,
  isLinkActive,
  navSections,
  NavLink,
  navItemIsVisible,
  settingsSection,
} from "@/components/layout/app-sidebar";
import { AppRefreshButton } from "@/components/layout/app-refresh-button";
import { useAppShellData } from "@/components/layout/app-shell-data-provider";
import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const pathname = usePathname();
  const { account, navBadges } = useAppShellData();
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
  const showClubConfig = configOpen || inClubConfig;
  const profileQuickLinks = account?.productProfile === "GYM_ONLY"
    ? [
        { href: "/", label: "Accueil", icon: Home },
        { href: "/gym/check-in", label: "Accès", icon: Dumbbell, moduleKey: "GYM_ACCESS" as const, permission: "gym.checkin" as const },
        { href: "/enrollment", label: "Inscrire", icon: PlusCircle, featured: true, permission: "enrollment.sell" as const },
        { href: "/payments/new", label: "Caisse", icon: Banknote, permission: "payments.collect" as const },
        { href: "/members", label: "Membres", icon: Search, permission: "members.manage" as const },
      ]
    : account?.productProfile === "HYBRID"
      ? [
          { href: "/", label: "Accueil", icon: Home },
          { href: "/attendance/today", label: "Pointage", icon: Clock, moduleKey: "CLASS_MANAGEMENT" as const, permission: "class.attendance" as const },
          { href: "/gym/check-in", label: "Accès", icon: Dumbbell, moduleKey: "GYM_ACCESS" as const, permission: "gym.checkin" as const },
          { href: "/enrollment", label: "Inscrire", icon: PlusCircle, featured: true, permission: "enrollment.sell" as const },
          { href: "/payments/new", label: "Caisse", icon: Banknote, permission: "payments.collect" as const },
        ]
      : [
          { href: "/", label: "Accueil", icon: Home },
          { href: "/attendance/today", label: "Pointage", icon: Clock, moduleKey: "CLASS_MANAGEMENT" as const, permission: "class.attendance" as const },
          { href: "/enrollment", label: "Inscrire", icon: PlusCircle, featured: true, permission: "enrollment.sell" as const },
          { href: "/payments/new", label: "Caisse", icon: Banknote, permission: "payments.collect" as const },
          { href: "/members", label: "Membres", icon: Search, permission: "members.manage" as const },
        ];
  const quickLinks = profileQuickLinks.filter((item) => navItemIsVisible(item, account));

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div data-app-mobile-nav className="print:hidden lg:hidden">
      <div className="fixed left-0 right-0 top-0 z-50 flex min-h-[3.75rem] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-3 py-2 shadow-[var(--shadow-panel)] backdrop-blur lg:hidden">
        <Link
          href="/"
          className="flex min-w-0 max-w-[48%] items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-[var(--surface-soft)] sm:max-w-[55%]"
        >
          <ClubBrandMark size="sm" />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SetupGuide variant="header" className="hidden min-[430px]:block" />
          <AppRefreshButton className="!size-11 hidden min-[380px]:flex" />
          <NotificationCenter />
          <UserAccountMenu onNavigate={close} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-[var(--shadow-panel)] transition-colors hover:bg-[var(--surface)]"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={close} />}

      <div
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cn(
          "app-sidebar-theme fixed bottom-0 left-0 top-[3.75rem] z-40 w-[min(86vw,320px)] transform border-r border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-floating)] transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="sidebar-scroll flex h-full flex-col gap-1 overflow-y-auto overscroll-y-contain px-3 pb-24 pt-4">
          <SetupGuide variant="bar" className="mb-2 rounded-lg border border-[var(--primary)]/20" />

          {visibleNavSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60">
                {section.title}
              </p>
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={close} badge={navBadges[item.href]} />
              ))}
            </div>
          ))}

          {configurationSections.length > 0 ? (
            <div className="mt-2 border-t border-[var(--border)] pt-2">
            <button
              onClick={() => setConfigOpen((v) => !v)}
              aria-expanded={showClubConfig}
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60">
                {settingsSection.title}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", showClubConfig ? "rotate-180" : "")} />
            </button>

            {showClubConfig && (
              <div className="space-y-0.5">
                {configurationSections.map((section, sectionIndex) => (
                  <div
                    key={section.title}
                    className={cn(sectionIndex > 0 && "mt-2 border-t border-[var(--border)] pt-2")}
                  >
                    {sectionIndex > 0 ? (
                      <p className="mb-1 px-3 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60">
                        {section.title}
                      </p>
                    ) : null}
                    {section.items.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} onClick={close} badge={navBadges[item.href]} />
                    ))}
                  </div>
                ))}
              </div>
            )}
            </div>
          ) : null}
        </nav>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_20px_rgba(15,23,42,0.1)] backdrop-blur lg:hidden dark:shadow-[0_-10px_28px_rgba(0,0,0,0.45)]">
        <nav
          className="mobile-quick-nav grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, quickLinks.length)}, minmax(0, 1fr))` }}
        >
          {quickLinks.map((item) => (
            <QuickMobileLink
              key={item.href}
              {...item}
              pathname={pathname}
              badge={navBadges[item.href]}
            />
          ))}
        </nav>
      </div>

      <div className="h-[3.75rem] lg:hidden" />
    </div>
  );
}

function QuickMobileLink({
  href,
  label,
  icon: Icon,
  pathname,
  featured,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  featured?: boolean;
  badge?: { label: string; tone: "blue" | "amber" | "red" } | null;
}) {
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const activeFg = "text-[var(--primary-foreground)]";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.62rem] font-bold transition",
        active
          ? cn("bg-[var(--primary)] shadow-[var(--shadow-panel)]", activeFg, "[&_svg]:text-[var(--primary-foreground)]")
          : featured
            ? "bg-[var(--primary)]/10 text-[var(--primary)] [&_svg]:text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] [&_svg]:text-[var(--muted-foreground)]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && activeFg)} />
      <span className={cn("max-w-full truncate", active && activeFg)}>{label}</span>
      {badge ? (
        <span
          className={cn(
            "absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[0.55rem] font-black leading-4 ring-2 ring-[var(--surface)]",
            badge.tone === "red" && "bg-[var(--danger)] text-white",
            badge.tone === "amber" && "bg-[var(--warning)] text-white",
            badge.tone === "blue" && "bg-[var(--primary)] text-white",
          )}
        >
          {badge.label}
        </span>
      ) : null}
    </Link>
  );
}
