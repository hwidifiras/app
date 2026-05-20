"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Banknote, Clock, Home, Menu, PlusCircle, Search, X, Dumbbell } from "lucide-react";

import { APP_BRAND_NAME } from "@/lib/app-name";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SetupGuide } from "@/components/onboarding/setup-guide";
import {
  navSections,
  settingsSection,
  NavLink,
} from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const inSettings = settingsSection.items.some((item) =>
    item.href === "/settings"
      ? pathname === "/settings" || pathname.startsWith("/settings/")
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const showSettings = settingsOpen || inSettings;

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
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-[var(--surface-soft)]">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Dumbbell className="size-4" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-[var(--foreground)]">{APP_BRAND_NAME}</span>
            <span className="block text-[0.65rem] font-medium text-[var(--muted-foreground)]">Réception</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <SetupGuide variant="header" />
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
        <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-24 pt-4">
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

          {/* Settings toggle */}
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={showSettings}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60">
                Paramètres
              </span>
              <X
                className={cn(
                  "size-4 shrink-0 rotate-45 transition-transform",
                  showSettings ? "rotate-0" : "",
                )}
              />
            </button>

            {showSettings && (
              <div className="space-y-0.5">
                {settingsSection.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
            <ThemeToggle compact />
            <LogoutButton onDone={close} />
          </div>
        </nav>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(0,0,0,0.18)] backdrop-blur lg:hidden dark:shadow-[0_-10px_28px_rgba(0,0,0,0.45)]">
        <nav className="grid grid-cols-5 gap-1">
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

  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.64rem] font-bold transition",
        active
          ? "bg-[var(--primary)] text-white shadow-sm"
          : featured
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
