type PageHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ overline, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-4 grid min-w-0 gap-3 md:mb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-5">
      <div className="min-w-0">
        {overline ? (
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[var(--primary)]">
            {overline}
          </p>
        ) : null}
        <h1 className="text-[1.55rem] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--foreground)] md:text-[1.85rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="page-actions min-w-0 md:justify-end">{actions}</div> : null}
    </header>
  );
}
