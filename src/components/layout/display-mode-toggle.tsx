"use client";

import { Maximize2, PanelTop } from "lucide-react";

import { useSidebarLayout } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

export function DisplayModeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { displayMode, setDisplayMode } = useSidebarLayout();

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-1",
        className,
      )}
      role="group"
      aria-label="Largeur d'affichage"
    >
      <button
        type="button"
        onClick={() => setDisplayMode("compact")}
        aria-pressed={displayMode === "compact"}
        title="Vue compacte et centrée"
        className={cn(
          "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition",
          displayMode === "compact"
            ? "bg-[var(--surface)] text-[var(--primary)] shadow-[var(--shadow-panel)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
      >
        <PanelTop className="size-3.5" />
        {!compact ? <span>Compact</span> : null}
      </button>
      <button
        type="button"
        onClick={() => setDisplayMode("wide")}
        aria-pressed={displayMode === "wide"}
        title="Vue large, largeur actuelle"
        className={cn(
          "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition",
          displayMode === "wide"
            ? "bg-[var(--surface)] text-[var(--primary)] shadow-[var(--shadow-panel)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
      >
        <Maximize2 className="size-3.5" />
        {!compact ? <span>Large</span> : null}
      </button>
    </div>
  );
}
