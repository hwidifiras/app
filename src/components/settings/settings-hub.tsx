import Link from "next/link";
import type { ComponentType } from "react";

export function SettingsMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-black text-[var(--foreground)]">{value}</p>
      <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

export function SettingsTile({
  href,
  secondaryHref,
  secondaryLabel,
  icon: Icon,
  overline,
  title,
  description,
  meta,
}: {
  href: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  icon: ComponentType<{ className?: string }>;
  overline: string;
  title: string;
  description: string;
  meta: string[];
}) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            {overline}
          </p>
          <h2 className="mt-1 text-base font-black text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {meta.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link href={href} className="btn btn-primary btn-block-mobile">
          Ouvrir
        </Link>
        {secondaryHref ? (
          <Link href={secondaryHref} className="btn btn-ghost btn-block-mobile">
            {secondaryLabel ?? "Voir aussi"}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
