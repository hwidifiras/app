import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="text-[var(--muted-foreground)]">
        {icon ?? <Inbox className="size-8 opacity-40" />}
      </span>
      <div>
        {title ? <p className="font-semibold text-[var(--foreground)]">{title}</p> : null}
        <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{message}</p>
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
