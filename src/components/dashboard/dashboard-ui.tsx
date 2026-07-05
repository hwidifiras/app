import type React from "react";

import { cn } from "@/lib/utils";

export type IconComponent = React.ComponentType<{ className?: string }>;
export type DashboardTone = "blue" | "green" | "amber" | "red" | "slate";

export const dashboardToneStyles: Record<
  DashboardTone,
  {
    icon: string;
    badge: string;
    text: string;
    soft: string;
    border: string;
  }
> = {
  blue: {
    icon: "bg-[#2563EB] text-white",
    badge: "bg-[#EFF6FF] text-[#1D4ED8]",
    text: "text-[#2563EB]",
    soft: "bg-[#EFF6FF]",
    border: "border-[#BFDBFE]",
  },
  green: {
    icon: "bg-[#10B981] text-white",
    badge: "bg-[#ECFDF5] text-[#047857]",
    text: "text-[#047857]",
    soft: "bg-[#ECFDF5]",
    border: "border-[#A7F3D0]",
  },
  amber: {
    icon: "bg-[#F59E0B] text-white",
    badge: "bg-[#FFFBEB] text-[#B45309]",
    text: "text-[#B45309]",
    soft: "bg-[#FFFBEB]",
    border: "border-[#FDE68A]",
  },
  red: {
    icon: "bg-[#EF4444] text-white",
    badge: "bg-[#FEF2F2] text-[#B91C1C]",
    text: "text-[#DC2626]",
    soft: "bg-[#FEF2F2]",
    border: "border-[#FECACA]",
  },
  slate: {
    icon: "bg-[#0B1220] text-white",
    badge: "bg-[#F1F5F9] text-[#334155]",
    text: "text-[#334155]",
    soft: "bg-[#F8FAFC]",
    border: "border-[#CBD5E1]",
  },
};

export function DashboardPanel({
  children,
  className,
  labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-lg border border-[#DDE7F4] bg-white text-[#111827] shadow-[0_16px_38px_rgba(15,23,42,0.055)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DashboardSectionHeader({
  title,
  eyebrow,
  action,
  titleId,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-300">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="text-base font-semibold leading-tight text-[#0B1220] dark:text-slate-50">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
