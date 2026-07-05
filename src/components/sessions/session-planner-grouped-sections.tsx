import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SessionDto } from "@/types/session";

export type GroupedPlanningSection = {
  key: string;
  label: string;
  meta: string;
  sessions: SessionDto[];
};

export function PlanningGroupedSections({
  sections,
  conflictSessionIds,
  renderSessionTile,
}: {
  sections: GroupedPlanningSection[];
  conflictSessionIds: Set<string>;
  renderSessionTile: (session: SessionDto) => ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <section
          key={section.key}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-panel)]"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-[var(--foreground)]">{section.label}</h3>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{section.meta}</p>
            </div>
            <StatusBadge
              variant={section.sessions.some((session) => conflictSessionIds.has(session.id)) ? "danger" : "muted"}
            >
              {section.sessions.length} cours
            </StatusBadge>
          </div>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {section.sessions.map(renderSessionTile)}
          </ul>
        </section>
      ))}
    </div>
  );
}
