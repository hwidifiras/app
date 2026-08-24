"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

import { SessionDetailPanel } from "@/components/sessions/session-planner-ui";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import type { SessionDto } from "@/types/session";

const WIDE_PLANNING_QUERY = "(min-width: 1440px)";

function subscribeWidePlanningLayout(callback: () => void) {
  const mediaQuery = window.matchMedia(WIDE_PLANNING_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getWidePlanningSnapshot() {
  return window.matchMedia(WIDE_PLANNING_QUERY).matches;
}

export function SessionPlannerDetailSheet({
  open,
  session,
  conflictReasons,
  onEdit,
  onCancel,
  onClose,
  canManage,
  readOnly,
}: {
  open: boolean;
  session: SessionDto | null;
  conflictReasons: string[];
  onEdit: (session: SessionDto) => void;
  onCancel: (session: SessionDto) => void;
  onClose: () => void;
  canManage: boolean;
  readOnly: boolean;
}) {
  const isWidePlanningLayout = useSyncExternalStore(
    subscribeWidePlanningLayout,
    getWidePlanningSnapshot,
    () => true,
  );
  const titleId = useId();
  const dialogOpen = open && Boolean(session) && !isWidePlanningLayout;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: dialogOpen,
    onClose,
  });

  useEffect(() => {
    if (open && isWidePlanningLayout) onClose();
  }, [isWidePlanningLayout, onClose, open]);

  if (!dialogOpen || !session) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-[var(--overlay)] sm:items-stretch sm:justify-end min-[1440px]:hidden"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-floating)] sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-l-xl sm:rounded-tr-none"
      >
        <SessionDetailPanel
          session={session}
          conflictReasons={conflictReasons}
          onEdit={onEdit}
          onCancel={onCancel}
          onClose={onClose}
          titleId={titleId}
          canManage={canManage}
          readOnly={readOnly}
          className="min-h-full rounded-none border-0 shadow-none"
        />
      </div>
    </div>
  );
}
