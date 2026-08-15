"use client";

import { useId, useRef } from "react";
import { Info, X } from "lucide-react";

import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

export function NoticeDialog({
  open,
  title,
  description,
  closeLabel = "Compris",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLElement>({
    open,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="max-h-[min(90dvh,40rem)] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-floating)] sm:max-w-lg sm:rounded-lg sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--info-surface)] text-[var(--info)]" aria-hidden="true">
            <Info className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost -mr-2 -mt-2 inline-flex size-10 shrink-0 items-center justify-center p-0"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <button ref={closeButtonRef} type="button" onClick={onClose} className="btn btn-primary btn-block-mobile">
            {closeLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
