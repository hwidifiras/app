"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Banknote, ChevronDown, Clock, Home, Menu, PlusCircle, Search, X } from "lucide-react";

import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { cn } from "@/lib/utils";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import {
  navSections,
  clubConfigSection,
  NavLink,
} from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const pathname = usePathname();
  const inClubConfig = clubConfigSection.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const showClubConfig = configOpen || inClubConfig;

  const close = useCallback(() => setOpen(false), []);

  // Close drawer on route change
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when drawer is open
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
      {/* Burger button */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2.5 shadow-sm backdrop-blur lg:hidden">
        <Link href="/" className="flex min-w-0 max-w-[55%] items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-[var(--surface-soft)]">
          <ClubBrandMark size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <SetupGuide variant="header" />
          <UserAccountMenu onNavigate={close} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--surface)]"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 top-[57px] z-40 w-[min(86vw,320px)] transform bg-[var(--surface)] shadow-xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="sidebar-scroll flex h-full flex-col gap-1 overflow-y-auto overscroll-y-contain px-3 pb-24 pt-4">
          {/* Spacer for top bar height offset */}
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

          {/* Configuration club */}
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <button
              onClick={() => setConfigOpen((v) => !v)}
              aria-expanded={showClubConfig}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60">
                {clubConfigSection.title}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  showClubConfig ? "rotate-180" : "",
                )}
              />
            </button>

            {showClubConfig && (
              <div className="space-y-0.5">
                {clubConfigSection.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(0,0,0,0.18)] backdrop-blur lg:hidden dark:shadow-[0_-10px_28px_rgba(0,0,0,0.45)]">
        <nav className="mobile-quick-nav grid grid-cols-5 gap-1">
          <QuickMobileLink href="/" label="Accueil" icon={Home} pathname={pathname} />
          <QuickMobileLink href="/attendance/today" label="Pointer" icon={Clock} pathname={pathname} />
          <QuickMobileLink href="/enrollment" label="Inscrire" icon={PlusCircle} pathname={pathname} featured />
          <QuickMobileLink href="/payments/new" label="Caisse" icon={Banknote} pathname={pathname} />
          <QuickMobileLink href="/members" label="Élèves" icon={Search} pathname={pathname} />
        </nav>
      </div>

      {/* Content padding compensation for fixed bars on mobile */}
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
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.64rem] font-bold transition",
        active
          ? cn(
              "bg-[var(--primary)] shadow-sm",
              activeFg,
              "[&_svg]:text-[var(--primary-foreground)]",
            )
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
