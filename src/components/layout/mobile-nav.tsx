"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Dumbbell } from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  navSections,
  settingsSection,
  NavLink,
} from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

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
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Dumbbell className="size-4" />
          </div>
          <span className="text-sm font-bold text-[var(--foreground)]">GYM SaaS</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-lg text-[var(--foreground)] transition-colors hover:bg-[var(--surface-soft)]"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
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
          "fixed bottom-0 left-0 top-[52px] z-40 w-[280px] transform bg-white shadow-xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
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
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-60">
                Paramètres
              </span>
              <X
                className={cn(
                  "size-4 shrink-0 rotate-45 transition-transform",
                  settingsOpen ? "rotate-0" : "",
                )}
              />
            </button>

            {settingsOpen && (
              <div className="space-y-0.5">
                {settingsSection.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <LogoutButton onDone={close} />
          </div>
        </nav>
      </div>

      {/* Content padding compensation for fixed top bar on mobile */}
      <div className="h-[52px] lg:hidden" />
    </>
  );
}
