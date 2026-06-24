"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, ChevronDown, Clock, Home, Menu, PlusCircle, Search, X } from "lucide-react";

import {
  clubConfigSection,
  getConfigurationSections,
  isLinkActive,
  navSections,
  NavLink,
} from "@/components/layout/app-sidebar";
import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import { cn } from "@/lib/utils";

function useAccountRole() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok) return;
        const account = (await response.json()) as { role?: string };
        if (!cancelled) setRole(account.role ?? null);
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const pathname = usePathname();
  const role = useAccountRole();
  const configurationSections = getConfigurationSections(role);
  const inClubConfig = configurationSections.some((section) =>
    section.items.some((item) => isLinkActive(pathname, item.href)),
  );
  const showClubConfig = configOpen || inClubConfig;

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
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/96 px-3 py-2.5 shadow-sm backdrop-blur lg:hidden">
        <Link
          href="/"
          className="flex min-w-0 max-w-[55%] items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-[var(--surface-soft)]"
        >
          <ClubBrandMark size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <SetupGuide variant="header" />
          <NotificationCenter />
          <UserAccountMenu onNavigate={close} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--surface)]"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={close} />}

      <div
        className={cn(
          "fixed bottom-0 left-0 top-[57px] z-40 w-[min(86vw,320px)] transform bg-[var(--surface)] shadow-xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="sidebar-scroll flex h-full flex-col gap-1 overflow-y-auto overscroll-y-contain px-3 pb-24 pt-4">
          <div className="shrink-0" />

          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60">
                {section.title}
              </p>
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />
              ))}
            </div>
          ))}

          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <button
              onClick={() => setConfigOpen((v) => !v)}
              aria-expanded={showClubConfig}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60">
                {clubConfigSection.title}
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
                      <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden dark:shadow-[0_-10px_28px_rgba(0,0,0,0.45)]">
        <nav className="mobile-quick-nav grid grid-cols-5 gap-1">
          <QuickMobileLink href="/" label="Accueil" icon={Home} pathname={pathname} />
          <QuickMobileLink href="/attendance/today" label="Pointage" icon={Clock} pathname={pathname} />
          <QuickMobileLink href="/enrollment" label="Inscrire" icon={PlusCircle} pathname={pathname} featured />
          <QuickMobileLink href="/payments/new" label="Caisse" icon={Banknote} pathname={pathname} />
          <QuickMobileLink href="/members" label="Membres" icon={Search} pathname={pathname} />
        </nav>
      </div>

      <div className="h-[57px] lg:hidden" />
    </>
  );
}

function QuickMobileLink({
  href,
  label,
  icon: Icon,
  pathname,
  featured,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  featured?: boolean;
}) {
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const activeFg = "text-[var(--primary-foreground)]";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.64rem] font-bold transition",
        active
          ? cn("bg-[var(--primary)] shadow-sm", activeFg, "[&_svg]:text-[var(--primary-foreground)]")
          : featured
            ? "bg-[var(--primary)]/10 text-[var(--primary)] [&_svg]:text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] [&_svg]:text-[var(--muted-foreground)]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && activeFg)} />
      <span className={cn("max-w-full truncate", active && activeFg)}>{label}</span>
    </Link>
  );
}
