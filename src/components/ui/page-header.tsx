type PageHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ overline, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1">
        {overline ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {overline}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">{actions}</div> : null}
    </div>
  );
}
