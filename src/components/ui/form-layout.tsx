import { cn } from "@/lib/utils";

export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "form-section-anchor rounded-lg border border-border/80 bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] md:p-4",
        className,
      )}
    >
      {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className={cn(title || description ? "mt-3" : undefined)}>{children}</div>
    </section>
  );
}

export function FormSectionNav({
  items,
  className,
}: {
  items: Array<{ href: string; label: string }>;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      className={cn(
        "form-section-nav rounded-lg border border-border/80 bg-[var(--surface)]/96 p-2 shadow-[var(--shadow-panel)]",
        className,
      )}
      aria-label="Sections du formulaire"
    >
      {items.map((item) => (
        <a key={item.href} href={item.href} className="form-section-nav-link">
          {item.label}
        </a>
      ))}
    </nav>
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
        cols === 2 && "grid-cols-1 md:grid-cols-2",
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
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
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
          "sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-20 rounded-t-lg border-t border-border bg-[var(--background)] pb-2 pt-2 shadow-[0_-10px_24px_-8px_rgba(15,23,42,0.14)] md:bottom-0 md:-mx-4 md:rounded-none md:px-4 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
