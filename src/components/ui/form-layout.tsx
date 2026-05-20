import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/80 bg-[var(--surface)]/90 p-3.5 sm:p-4", className)}>
      {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className={cn(title || description ? "mt-3" : undefined)}>{children}</div>
    </section>
  );
}

export function FormGrid({
  children,
  className,
  cols = 2,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 1 && "grid-cols-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormActions({
  children,
  className,
  sticky,
}: {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "form-actions mt-4 border-t border-border/70 pt-4",
        sticky &&
          "sticky bottom-0 z-10 -mx-3.5 border-t border-border bg-[linear-gradient(180deg,transparent_0%,var(--surface)_24%)] px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-4 sm:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
