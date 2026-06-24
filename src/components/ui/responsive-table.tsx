import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "data-table overflow-x-auto rounded-lg border border-border bg-[var(--surface)] shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      <table className="w-full min-w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <thead
      className={cn(
        "bg-[var(--surface-soft)] text-xs uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function DataTableBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn("divide-y divide-border/80", className)}>{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  expanded,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  expanded?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-[var(--surface-soft)]",
        expanded !== undefined && "mobile-collapsible-row",
        expanded && "is-expanded",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("h-10 px-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  label,
  mobileDetail,
  primary,
}: {
  children?: React.ReactNode;
  className?: string;
  label?: string;
  mobileDetail?: boolean;
  primary?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-[0.86rem] align-middle text-[var(--foreground)]",
        mobileDetail && "mobile-detail-cell",
        primary && "data-table-primary",
        className,
      )}
      data-label={label}
    >
      {children}
    </td>
  );
}

export function TableActionsCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("card-actions-cell px-4 py-3 text-right", className)} data-label="Actions">
      <div className="card-actions-stack">{children}</div>
    </td>
  );
}

export function MobileRowToggle({
  expanded,
  onToggle,
  className,
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <td className={cn("mobile-toggle-cell px-4 py-3 text-center md:hidden", className)}>
      <button type="button" className="mobile-card-toggle" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? "Voir moins" : "Voir plus"}
        <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
      </button>
    </td>
  );
}

export function DataTableEmpty({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}
