"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ChevronDown, CircleUser, LogOut, Users } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

type AccountData = {
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function UserAccountMenu({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setAccount({
            name: json.data.name,
            email: json.data.email,
            role: json.data.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    onNavigate?.();
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    close();
    router.replace("/login");
    router.refresh();
  }

  const isAdmin = account?.role === "ADMIN";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu compte"
        className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5 text-left transition hover:bg-[var(--surface)]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">
          {account ? initials(account.name) : "…"}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-[var(--foreground)] sm:block">
          {account?.name ?? "Compte"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] w-[min(calc(100vw-1.5rem),16rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg"
        >
          {account && (
            <div className="border-b border-[var(--border)] px-2 pb-2 pt-1">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{account.name}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{account.email}</p>
              <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--primary)]">
                {isAdmin ? "Administrateur" : "Équipe"}
              </p>
            </div>
          )}

          <div className="py-1">
            <AccountMenuLink href="/settings/account" icon={CircleUser} onClick={close}>
              Mon compte
            </AccountMenuLink>
          </div>

          {isAdmin && (
            <div className="border-t border-[var(--border)] py-1">
              <p className="px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] opacity-70">
                Administration
              </p>
              <AccountMenuLink href="/settings/users" icon={Users} onClick={close}>
                Utilisateurs
              </AccountMenuLink>
              <AccountMenuLink href="/logs" icon={Activity} onClick={close}>
                Journal actions
              </AccountMenuLink>
            </div>
          )}

          <div className="border-t border-[var(--border)] px-2 py-2">
            <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)] opacity-70">
              Apparence
            </p>
            <ThemeToggle compact />
          </div>

          <div className="border-t border-[var(--border)] pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={loggingOut}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <LogOut className="size-4 shrink-0 opacity-60" />
              {loggingOut ? "Déconnexion…" : "Déconnexion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
    >
      <Icon className="size-4 shrink-0 opacity-60" />
      {children}
    </Link>
  );
}
