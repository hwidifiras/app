import { Trash2 } from "lucide-react";

import { CLUB_DAY_SHORT_LABELS, type ClubDay } from "@/lib/club-working-days";
import type { GroupTypeValue } from "@/lib/demographics";
import { cn } from "@/lib/utils";

export type ScheduleSlotInput = {
  dayOfWeek: ClubDay;
  startTime: string;
  durationMinutes: number;
};

export type ScheduleTemplateDto = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  slots: Array<ScheduleSlotInput & { id: string }>;
};

export type ScheduleGroupOption = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  groupType: GroupTypeValue;
};

export type ScheduleSportOption = {
  id: string;
  name: string;
};

export type ScheduleTargetMode = "SELECTED_GROUPS" | "SPORT" | "GROUP_TYPE" | "ALL_ACTIVE";

export type ScheduleApplySummary = {
  templateName: string;
  targetGroups: Array<{ id: string; name: string; sportName: string; groupType: GroupTypeValue }>;
  groupCount: number;
  slotCount: number;
  newScheduleCount: number;
  closedScheduleCount: number;
  futureSessionsCount: number;
  closedDayWarnings: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
};

export const SCHEDULE_TARGET_MODE_OPTIONS: Array<{
  value: ScheduleTargetMode;
  label: string;
  description: string;
}> = [
  {
    value: "SELECTED_GROUPS",
    label: "Groupes sélectionnés",
    description: "Idéal pour changer quelques cours sans toucher au reste du planning.",
  },
  {
    value: "SPORT",
    label: "Une discipline",
    description: "Applique le modèle à tous les groupes actifs de la discipline choisie.",
  },
  {
    value: "GROUP_TYPE",
    label: "Enfants ou adultes",
    description: "Applique le modèle selon le public du cours.",
  },
  {
    value: "ALL_ACTIVE",
    label: "Tous les groupes actifs",
    description: "Action large pour préparer une nouvelle saison ou une période spéciale.",
  },
];

export function scheduleSlotLabel(slot: ScheduleSlotInput) {
  return `${CLUB_DAY_SHORT_LABELS[slot.dayOfWeek]} ${slot.startTime} (${slot.durationMinutes} min)`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "sans fin";
}

export function ScheduleTemplateCard({
  template,
  selected,
  onSelect,
  onArchive,
}: {
  template: ScheduleTemplateDto;
  selected: boolean;
  onSelect: () => void;
  onArchive: () => void;
}) {
  return (
    <article
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition",
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--foreground)]">{template.name}</p>
          {template.description ? (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{template.description}</p>
          ) : null}
          <p className="mt-2 text-xs font-medium text-[var(--muted-foreground)]">
            {template.slots.map(scheduleSlotLabel).join(" · ")}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onArchive();
        }}
        className="inline-flex rounded-md border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:text-[var(--danger)]"
        aria-label="Archiver le modèle"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  );
}

export function SelectedScheduleTemplateSummary({ template }: { template: ScheduleTemplateDto }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
        Modèle sélectionné
      </p>
      <p className="mt-1 font-semibold text-[var(--foreground)]">{template.name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {template.slots.map((slot) => (
          <span
            key={slot.id}
            className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]"
          >
            {scheduleSlotLabel(slot)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ScheduleApplyPreview({ preview }: { preview: ScheduleApplySummary }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
        Aperçu avant application
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <PreviewMetric label="Groupes" value={preview.groupCount} />
        <PreviewMetric label="Nouveaux horaires" value={preview.newScheduleCount} />
        <PreviewMetric label="Horaires fermés" value={preview.closedScheduleCount} />
        <PreviewMetric
          label="Séances futures existantes"
          value={preview.futureSessionsCount}
          warning={preview.futureSessionsCount > 0}
        />
      </div>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Période: du {formatDate(preview.effectiveFrom)} au {formatDate(preview.effectiveTo)}.
      </p>
      {preview.closedDayWarnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2 text-xs font-semibold text-[var(--warning)]">
          Jours fermés dans les réglages: {preview.closedDayWarnings.join(", ")}.
        </div>
      ) : null}
      <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-[var(--border)] p-2">
        {preview.targetGroups.map((group) => (
          <div key={group.id} className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5 last:border-b-0">
            <span className="truncate text-sm font-medium">{group.name}</span>
            <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{group.sportName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleApplySafetyCard({
  selectedTemplateName,
  targetLabel,
  targetCount,
  targetMode,
  replaceExisting,
  autoGenerate,
  closedSlots,
  hasPreview,
}: {
  selectedTemplateName: string | null;
  targetLabel: string;
  targetCount: number;
  targetMode: ScheduleTargetMode;
  replaceExisting: boolean;
  autoGenerate: boolean;
  closedSlots: string[];
  hasPreview: boolean;
}) {
  const isBroadTarget = targetMode !== "SELECTED_GROUPS";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
            Impact prévu
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {selectedTemplateName ? `Modèle « ${selectedTemplateName} »` : "Aucun modèle sélectionné"}
          </p>
        </div>
        <span
          className={cn(
            "w-fit rounded-full px-2.5 py-1 text-xs font-bold",
            hasPreview
              ? "bg-[var(--success)]/10 text-[var(--success)]"
              : "bg-[var(--primary)]/10 text-[var(--primary)]",
          )}
        >
          {hasPreview ? "Prévisualisé" : "Prévisualisation requise"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SafetyItem label="Cible" value={targetLabel} detail={`${targetCount} groupe${targetCount > 1 ? "s" : ""}`} />
        <SafetyItem
          label="Horaires"
          value={replaceExisting ? "Remplacer actifs/futurs" : "Ajouter seulement"}
          detail={replaceExisting ? "Les anciens créneaux des cibles seront fermés." : "Les créneaux existants restent actifs."}
        />
        <SafetyItem
          label="Séances"
          value={autoGenerate ? "Génération après application" : "Sans génération"}
          detail={autoGenerate ? "Crée les séances manquantes depuis les horaires." : "Les horaires sont prêts, séances à générer plus tard."}
        />
      </div>

      {isBroadTarget ? (
        <div className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--warning)]">
          Action large: vérifiez la liste des groupes et les séances futures dans l&apos;aperçu avant d&apos;appliquer.
        </div>
      ) : null}

      {closedSlots.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--danger)]">
          Créneau sur jour fermé: {closedSlots.join(", ")}. Le planning gardera visibles les séances réelles, mais ce modèle doit être vérifié.
        </div>
      ) : null}
    </div>
  );
}

function SafetyItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{value}</p>
      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function PreviewMetric({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        warning ? "border-[var(--warning)]/25 bg-[var(--warning)]/10" : "border-[var(--border)] bg-[var(--surface-soft)]",
      )}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
