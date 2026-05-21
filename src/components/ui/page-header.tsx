type PageHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ overline, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {overline ? (
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)] md:text-xs">
            {overline}
          </p>
        ) : null}
        <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-[var(--foreground)] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </div>
  );
}
