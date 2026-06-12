import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse space-y-3", className)}
      role="status"
      aria-label="Chargement en cours"
    >
      <div className="h-4 w-2/5 rounded-full bg-[var(--surface-soft)]" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-10 rounded-lg bg-[var(--surface-soft)]",
            index === lines - 1 && "w-4/5",
          )}
        />
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

export function CardGridSkeleton({
  cards = 3,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}
      role="status"
      aria-label="Chargement en cours"
    >
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[var(--border)] p-4">
          <div className="h-4 w-2/3 rounded-full bg-[var(--surface-soft)]" />
          <div className="mt-2 h-3 w-1/3 rounded-full bg-[var(--surface-soft)]" />
          <div className="mt-5 h-2 rounded-full bg-[var(--surface-soft)]" />
          <div className="mt-4 h-9 rounded-lg bg-[var(--surface-soft)]" />
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
