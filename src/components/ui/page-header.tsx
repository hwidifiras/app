type PageHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ overline, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {overline ? (
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)] md:text-[0.72rem]">
            {overline}
          </p>
        ) : null}
        <h1 className="text-[1.55rem] font-bold leading-tight text-[var(--foreground)] md:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-[var(--muted-foreground)] md:text-[0.92rem]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="page-actions shrink-0 md:justify-end">{actions}</div> : null}
    </div>
  );
}
