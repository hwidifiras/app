"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  User,
  CalendarDays,
  CalendarRange,
  CreditCard,
  ClipboardCheck,
  Activity,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Général",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Référentiels",
    items: [
      { href: "/members", label: "Membres", icon: Users },
      { href: "/sports", label: "Sports", icon: Dumbbell },
      { href: "/coaches", label: "Coachs", icon: User },
      { href: "/groups", label: "Groupes", icon: CalendarDays },
    ],
  },
  {
    title: "Planification",
    items: [
      { href: "/sessions", label: "Planning", icon: CalendarRange },
    ],
  },
  {
    title: "Abonnements & Finance",
    items: [
      { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
      { href: "/payments", label: "Paiements", icon: ClipboardCheck },
    ],
  },
  {
    title: "Suivi",
    items: [
      { href: "/attendance", label: "Présences", icon: Activity },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="border-b border-[var(--border)] bg-white/90 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4 lg:px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
          <Dumbbell className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">GYM SaaS</p>
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
            Réception
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            <p className="mb-1 hidden px-3 pt-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] opacity-60 lg:block">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all",
                    active
                      ? "bg-[var(--primary)]/8 text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/15"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-[var(--primary)]" : "opacity-60")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
