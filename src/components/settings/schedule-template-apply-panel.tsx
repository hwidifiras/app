import { CalendarPlus, Eye } from "lucide-react";

import type { GroupTypeValue } from "@/lib/demographics";
import {
  SCHEDULE_TARGET_MODE_OPTIONS,
  ScheduleApplyPreview,
  ScheduleApplySafetyCard,
  SelectedScheduleTemplateSummary,
  type ScheduleApplySummary,
  type ScheduleGroupOption,
  type ScheduleSportOption,
  type ScheduleTargetMode,
  type ScheduleTemplateDto,
} from "@/components/settings/schedule-template-ui";

type ScheduleTemplateApplyPanelProps = {
  message: string | null;
  templates: ScheduleTemplateDto[];
  selectedTemplate: ScheduleTemplateDto | null;
  targetMode: ScheduleTargetMode;
  sports: ScheduleSportOption[];
  groups: ScheduleGroupOption[];
  selectedGroupIds: string[];
  sportId: string;
  groupType: GroupTypeValue;
  targetLabel: string;
  targetCount: number;
  selectedTemplateClosedSlots: string[];
  effectiveFrom: string;
  effectiveTo: string;
  replaceExisting: boolean;
  autoGenerate: boolean;
  confirmFutureSessions: boolean;
  preview: ScheduleApplySummary | null;
  loading: boolean;
  onSelectTemplate: (templateId: string) => void;
  onTargetModeChange: (mode: ScheduleTargetMode) => void;
  onSportChange: (sportId: string) => void;
  onGroupTypeChange: (groupType: GroupTypeValue) => void;
  onToggleGroup: (groupId: string) => void;
  onEffectiveFromChange: (value: string) => void;
  onEffectiveToChange: (value: string) => void;
  onReplaceExistingChange: (checked: boolean) => void;
  onAutoGenerateChange: (checked: boolean) => void;
  onConfirmFutureSessionsChange: (checked: boolean) => void;
  onPreviewApply: () => void;
  onApplyTemplate: () => void;
};

export function ScheduleTemplateApplyPanel({
  message,
  templates,
  selectedTemplate,
  targetMode,
  sports,
  groups,
  selectedGroupIds,
  sportId,
  groupType,
  targetLabel,
  targetCount,
  selectedTemplateClosedSlots,
  effectiveFrom,
  effectiveTo,
  replaceExisting,
  autoGenerate,
  confirmFutureSessions,
  preview,
  loading,
  onSelectTemplate,
  onTargetModeChange,
  onSportChange,
  onGroupTypeChange,
  onToggleGroup,
  onEffectiveFromChange,
  onEffectiveToChange,
  onReplaceExistingChange,
  onAutoGenerateChange,
  onConfirmFutureSessionsChange,
  onPreviewApply,
  onApplyTemplate,
}: ScheduleTemplateApplyPanelProps) {
  const selectedTargetModeOption =
    SCHEDULE_TARGET_MODE_OPTIONS.find((option) => option.value === targetMode) ?? SCHEDULE_TARGET_MODE_OPTIONS[0];

  return (
    <section className="panel p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Application</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Appliquer une saison</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Prévisualisez l&apos;impact, fermez les anciens horaires si besoin, puis ouvrez les nouveaux créneaux.
        </p>
      </div>

      {message ? (
        <div className="mt-3 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-3 py-2 text-sm font-medium text-[var(--foreground)]">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Modèle à appliquer</span>
          <select
            value={selectedTemplate?.id ?? ""}
            onChange={(event) => onSelectTemplate(event.target.value)}
            className="field"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        {selectedTemplate ? <SelectedScheduleTemplateSummary template={selectedTemplate} /> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Cible</span>
            <select value={targetMode} onChange={(event) => onTargetModeChange(event.target.value as ScheduleTargetMode)} className="field">
              {SCHEDULE_TARGET_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-[var(--muted-foreground)]">
              {selectedTargetModeOption.description}
            </p>
          </label>
          {targetMode === "SPORT" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Discipline</span>
              <select value={sportId} onChange={(event) => onSportChange(event.target.value)} className="field">
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {targetMode === "GROUP_TYPE" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Type</span>
              <select value={groupType} onChange={(event) => onGroupTypeChange(event.target.value as GroupTypeValue)} className="field">
                <option value="ADULTS">Adultes</option>
                <option value="KIDS">Enfants</option>
                <option value="MIXED">Mixte âge</option>
              </select>
            </label>
          ) : null}
        </div>

        {targetMode === "SELECTED_GROUPS" ? (
          <div className="max-h-56 overflow-auto rounded-lg border border-[var(--border)] p-2">
            {groups.map((group) => (
              <label key={group.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-soft)]">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => onToggleGroup(group.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{group.sportName}</span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
          {targetCount} groupe{targetCount > 1 ? "s" : ""} cible{targetCount > 1 ? "s" : ""}.
          {selectedTemplateClosedSlots.length > 0 ? (
            <span className="ml-1 font-semibold text-[var(--warning)]">
              Attention: {selectedTemplateClosedSlots.join(", ")} tombe{selectedTemplateClosedSlots.length > 1 ? "nt" : ""} sur un jour fermé.
            </span>
          ) : null}
        </div>

        <ScheduleApplySafetyCard
          selectedTemplateName={selectedTemplate?.name ?? null}
          targetLabel={targetLabel}
          targetCount={targetCount}
          targetMode={targetMode}
          replaceExisting={replaceExisting}
          autoGenerate={autoGenerate}
          closedSlots={selectedTemplateClosedSlots}
          hasPreview={Boolean(preview)}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Appliquer à partir du</span>
            <input type="date" value={effectiveFrom} onChange={(event) => onEffectiveFromChange(event.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Fin optionnelle</span>
            <input
              type="date"
              value={effectiveTo}
              min={effectiveFrom}
              onChange={(event) => onEffectiveToChange(event.target.value)}
              className="field"
            />
          </label>
        </div>

        <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => onReplaceExistingChange(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>Fermer les horaires actifs/futurs des groupes cibles avant d&apos;ouvrir les nouveaux créneaux.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(event) => onAutoGenerateChange(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>Générer les séances manquantes après application des horaires.</span>
          </label>
          {preview?.futureSessionsCount ? (
            <label className="flex items-start gap-2 text-[var(--warning)]">
              <input
                type="checkbox"
                checked={confirmFutureSessions}
                onChange={(event) => onConfirmFutureSessionsChange(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--warning)]"
              />
              <span>Je confirme: {preview.futureSessionsCount} séances futures existent déjà et resteront visibles.</span>
            </label>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onPreviewApply} disabled={loading || !selectedTemplate} className="btn btn-ghost btn-block-mobile">
            <Eye className="size-4" />
            Prévisualiser l&apos;impact
          </button>
          <button
            type="button"
            onClick={onApplyTemplate}
            disabled={loading || !selectedTemplate || !preview || (preview.futureSessionsCount > 0 && !confirmFutureSessions)}
            className="btn btn-primary btn-block-mobile"
          >
            <CalendarPlus className="size-4" />
            Appliquer les horaires
          </button>
        </div>

        {preview ? <ScheduleApplyPreview preview={preview} /> : null}
      </div>
    </section>
  );
}
