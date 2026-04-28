import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  message: string;
  className?: string;
};

export function EmptyState({ icon, message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="text-[var(--muted-foreground)]">
        {icon ?? <Inbox className="size-8 opacity-40" />}
      </span>
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
