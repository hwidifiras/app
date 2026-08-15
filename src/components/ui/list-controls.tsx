"use client";

import { useId, useRef } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

import { FieldControl } from "@/components/ui/field-control";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { cn } from "@/lib/utils";

export function ListSearch({
  value,
  onChange,
  placeholder,
  className,
  id,
  ariaLabel = "Rechercher dans la liste",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <FieldControl
      className={cn("list-search-control min-w-0 flex-1", className)}
      icon={<Search className="size-4" />}
      action={
        value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex size-full items-center justify-center"
            aria-label="Effacer la recherche"
          >
            <X className="size-4" />
          </button>
        ) : undefined
      }
    >
      <input
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("field list-search-input has-leading-icon w-full text-sm", value && "has-trailing-action")}
        type="search"
        enterKeyHint="search"
      />
    </FieldControl>
  );
}

export function MobileFiltersButton({
  onClick,
  count = 0,
}: {
  onClick: () => void;
  count?: number;
}) {
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost mobile-filters-button min-h-12 shrink-0 md:hidden">
      <SlidersHorizontal className="size-4" />
      Filtres
      {count > 0 ? (
        <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[0.65rem] text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function MobileFilterSheet({
  open,
  onClose,
  onReset,
  activeCount,
  resultCount,
  title = "Filtres",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  activeCount: number;
  resultCount: number;
  title?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[var(--overlay)] md:hidden" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="max-h-[86dvh] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeCount > 0 ? `${activeCount} filtre(s) actif(s)` : "Aucun filtre actif"}
            </p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="btn btn-ghost min-h-11 min-w-11 p-2">
            <X className="size-5" />
            <span className="sr-only">Fermer</span>
          </button>
        </div>

        <div className="grid gap-4">{children}</div>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onReset} className="btn btn-ghost min-h-12">
            <RotateCcw className="size-4" />
            Réinitialiser
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary min-h-12">
            Voir {resultCount} résultat{resultCount > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--foreground)]">
      {label}
      {children}
    </label>
  );
}
