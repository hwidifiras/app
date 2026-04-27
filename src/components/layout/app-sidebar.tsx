"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Dumbbell, User, CalendarDays, CalendarRange } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Membres", icon: Users },
  { href: "/sports", label: "Sports", icon: Dumbbell },
  { href: "/coaches", label: "Coachs", icon: User },
  { href: "/groups", label: "Groupes", icon: CalendarDays },
  { href: "/sessions", label: "Planning", icon: CalendarRange },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-[var(--border)] bg-white/90 backdrop-blur lg:sticky lg:top-0 lg:min-h-screen lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 lg:px-5">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            MVP Réception
          </p>
          <p className="text-base font-semibold text-[var(--foreground)]">GYM SaaS</p>
          <p className="text-xs text-[var(--muted-foreground)]">Interface front desk</p>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible lg:px-4 lg:py-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border-[var(--primary)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-sm"
                  : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-white hover:text-[var(--foreground)]",
              )}
            >
              <Icon className="size-[1.05rem]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
