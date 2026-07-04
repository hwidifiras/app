import type { ReactNode } from "react";

import { formatMoney } from "@/lib/money";

type ReceptionInfoCardProps = {
  title?: string;
  children: ReactNode;
  variant?: "info" | "warning" | "success";
  className?: string;
};

const variantClasses = {
  info: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]",
  warning: "border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
  success: "border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
};

export function ReceptionInfoCard({
  title,
  children,
  variant = "info",
  className = "",
}: ReceptionInfoCardProps) {
  return (
    <aside
      className={`rounded-lg border p-3 text-sm shadow-[var(--shadow-panel)] sm:p-4 ${variantClasses[variant]} ${className}`}
    >
      {title ? <p className="mb-1.5 text-xs font-bold uppercase tracking-wide opacity-80">{title}</p> : null}
      <div className="space-y-1 leading-relaxed">{children}</div>
    </aside>
  );
}

export function SubscriptionBillingSummary({
  amountDueCents,
  totalPaidCents,
  remainingSessions,
  totalSessions,
  endDateLabel,
}: {
  amountDueCents: number;
  totalPaidCents: number;
  remainingSessions?: number;
  totalSessions?: number;
  endDateLabel?: string;
}) {
  const remainingDue = Math.max(0, amountDueCents - totalPaidCents);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "Dû", value: formatMoney(amountDueCents) },
        { label: "Payé", value: formatMoney(totalPaidCents) },
        { label: "Reste", value: formatMoney(remainingDue), highlight: remainingDue > 0 },
        {
          label: "Séances",
          value:
            remainingSessions !== undefined && totalSessions !== undefined
              ? `${remainingSessions} / ${totalSessions}`
              : "—",
        },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {item.label}
          </p>
          <p
            className={`mt-0.5 text-sm font-bold tabular-nums ${
              item.highlight ? "text-[var(--danger)]" : "text-[var(--foreground)]"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
      {endDateLabel ? (
        <p className="col-span-2 text-center text-xs text-[var(--muted-foreground)] sm:col-span-4">
          Validité jusqu&apos;au {endDateLabel}
        </p>
      ) : null}
    </div>
  );
}
