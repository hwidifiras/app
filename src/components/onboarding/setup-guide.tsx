"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Circle, X } from "lucide-react";

import type { SetupGuideProgress } from "@/lib/setup-guide";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "gymday-setup-guide-dismissed";

type SetupGuideProps = {
  variant: "bar" | "header";
  className?: string;
};

function GuidePanel({
  progress,
  nextStep,
  steps,
  onDismiss,
  onClose,
  className,
}: {
  progress: SetupGuideProgress;
  nextStep: SetupGuideProgress["nextStep"];
  steps: SetupGuideProgress["steps"];
  onDismiss: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">Premiers pas</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {progress.completedCount}/{progress.totalCount} terminé
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)]"
        >
          Masquer
        </button>
      </div>
      <ul className="space-y-1">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--muted-foreground)] line-through opacity-70">
                <Check className="size-4 shrink-0 text-[var(--success)]" />
                <span className="truncate">
                  {step.order}. {step.label}
                </span>
              </div>
            ) : (
              <Link
                href={step.href}
                onClick={onClose}
                className={cn(
                  "flex min-h-[2.5rem] items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                  step.id === nextStep?.id
                    ? "bg-[var(--primary)]/12 font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/25"
                    : "hover:bg-[var(--surface-soft)] text-[var(--foreground)]",
                )}
              >
                <Circle className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {step.order}. {step.label}
                </span>
                <ChevronRight className="size-4 shrink-0 opacity-60" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SetupGuide({ variant, className }: SetupGuideProps) {
  const pathname = usePathname();
  const [progress, setProgress] = useState<SetupGuideProgress | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/setup-guide", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) {
        setProgress(json.data as SetupGuideProgress);
        if (json.data.isComplete) {
          setOpen(false);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  if (!progress || progress.isComplete || dismissed) {
    return null;
  }

  const { nextStep, pendingCount, steps } = progress;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setOpen(false);
  }

  if (variant === "bar" && nextStep) {
    return (
      <div
        className={cn(
          "border-b border-primary/25 bg-primary/10 px-3 py-2.5 text-sm dark:bg-primary/15",
          className,
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {nextStep.order}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Configuration : {nextStep.label}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{nextStep.description}</p>
          </div>
          <Link href={nextStep.href} className="btn btn-primary shrink-0 px-3 py-1.5 text-xs sm:text-sm">
            Commencer
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="btn btn-ghost shrink-0 px-2 py-1.5 text-xs"
            aria-label="Masquer le guide"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === "header" && nextStep) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Premiers pas, ${pendingCount} étape(s) restante(s)`}
          className={cn(
            "inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border-2 border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2 text-sm font-semibold text-[var(--primary)] shadow-sm transition",
            "hover:border-[var(--primary)] hover:bg-[var(--primary)]/18 active:scale-[0.98]",
            open && "border-[var(--primary)] bg-[var(--primary)]/20 ring-2 ring-[var(--primary)]/25",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-xs font-bold text-white">
            {nextStep.order}
          </span>
          <span className="font-semibold lg:hidden">Guide</span>
          <span className="hidden min-w-0 text-left leading-tight lg:block">
            <span className="block text-[0.62rem] font-bold uppercase tracking-wide text-[var(--primary)]">
              Premiers pas
            </span>
            <span className="block max-w-[14rem] truncate text-sm font-semibold text-[var(--foreground)] xl:max-w-[22rem]">
              {nextStep.label}
            </span>
          </span>
          <span className="flex min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs font-bold text-white">
            {pendingCount}
          </span>
        </button>

        {open ? (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
            <GuidePanel
              progress={progress}
              nextStep={nextStep}
              steps={steps}
              onDismiss={dismiss}
              onClose={() => setOpen(false)}
              className="fixed right-3 top-[4.25rem] z-[70] w-[min(92vw,20rem)] lg:absolute lg:right-0 lg:top-full lg:mt-2 lg:w-80"
            />
          </>
        ) : null}
      </div>
    );
  }

  return null;
}
