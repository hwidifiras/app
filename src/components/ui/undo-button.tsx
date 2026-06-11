"use client";

import { Undo2 } from "lucide-react";

type UndoButtonProps = {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  title?: string;
  label?: string;
  className?: string;
};

export function UndoButton({
  onClick,
  disabled = false,
  title = "Annuler la dernière action",
  label,
  className = "",
}: UndoButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50 ${label ? "btn btn-ghost btn-sm px-3" : "size-9"} ${className}`}
      title={title}
      aria-label={title}
    >
      <Undo2 className="size-4" />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
