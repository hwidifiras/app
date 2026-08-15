"use client";

import { useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "warning";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  loading = false,
  tone = "danger",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLElement>({
    open,
    onClose: onCancel,
    closeOnEscape: !loading,
    initialFocusRef: cancelButtonRef,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-busy={loading}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="max-h-[min(90dvh,36rem)] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-floating)] sm:max-w-md sm:rounded-lg sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              tone === "danger"
                ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                : "bg-amber-500/10 text-amber-700",
            )}
            aria-hidden="true"
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost -mr-2 -mt-2 inline-flex size-10 shrink-0 items-center justify-center p-0"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={cn(
              "btn min-h-11 sm:min-w-32",
              tone === "danger" ? "btn-danger" : "btn-primary",
            )}
          >
            {loading ? "Traitement…" : confirmLabel}
          </button>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost min-h-11 sm:min-w-28"
          >
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
