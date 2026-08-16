import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const steps = [
  { label: "Club", short: "Club" },
  { label: "Activités", short: "Activités" },
  { label: "Règles", short: "Règles" },
  { label: "Prêt", short: "Prêt" },
] as const;

export function OnboardingProgress({ current }: { current: number }) {
  return (
    <nav aria-label="Configuration du club">
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li key={step.label} aria-current={active ? "step" : undefined}>
              <div className={cn("h-1 rounded-full", index <= current ? "bg-[var(--primary)]" : "bg-[var(--border)]")} />
              <div className="mt-2 flex min-w-0 items-center gap-1.5">
                <span className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold",
                  complete && "border-[var(--primary)] bg-[var(--primary)] text-white",
                  active && "border-[var(--primary)] bg-[var(--info-surface)] text-[var(--primary)]",
                  !complete && !active && "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
                )}>
                  {complete ? <Check className="size-3" /> : index + 1}
                </span>
                <span className={cn("truncate text-[0.68rem] font-semibold sm:text-xs", active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>{step.short}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
