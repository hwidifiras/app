import { cn } from "@/lib/utils";

type StatusBadgeVariant = "success" | "muted" | "danger" | "warning" | "info";

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "text-[var(--success)] bg-[var(--success-surface)]",
  muted: "text-[var(--muted-foreground)] bg-[var(--muted-surface)]",
  danger: "text-[var(--danger)] bg-[var(--danger-surface)]",
  warning: "text-[var(--warning)] bg-[var(--warning-surface)]",
  info: "text-[var(--info)] bg-[var(--info-surface)]",
};

type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold leading-tight tracking-wide",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
