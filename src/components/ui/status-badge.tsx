import { cn } from "@/lib/utils";

type StatusBadgeVariant = "success" | "muted" | "danger" | "warning" | "info";

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "text-[var(--success)] bg-[#e6f7ef]",
  muted: "text-[#5f7390] bg-[var(--surface-soft)]",
  danger: "text-[var(--danger)] bg-[#fdeaea]",
  warning: "text-[#b45309] bg-[#fef3c7]",
  info: "text-[var(--primary)] bg-[#e8f0fe]",
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
