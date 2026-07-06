"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarPlus, Eye } from "lucide-react";

import type { ClubDay } from "@/lib/club-working-days";
import type { GroupTypeValue } from "@/lib/demographics";
import { ScheduleTemplateLibraryPanel } from "@/components/settings/schedule-template-library-panel";
import {
  SCHEDULE_TARGET_MODE_OPTIONS,
  ScheduleApplyPreview,
  ScheduleApplySafetyCard,
  SelectedScheduleTemplateSummary,
  scheduleSlotLabel,
  type ScheduleApplySummary,
  type ScheduleGroupOption,
  type ScheduleSlotInput,
  type ScheduleSportOption,
  type ScheduleTargetMode,
  type ScheduleTemplateDto,
} from "@/components/settings/schedule-template-ui";

type ApplyResponse = {
  data?: {
    applied: boolean;
    summary: ScheduleApplySummary;
    generation?: { groupIds: string[]; horizonDays: number };
  };
  error?: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputToIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function emptySlot(): ScheduleSlotInput {
  return { dayOfWeek: "MONDAY", startTime: "18:00", durationMinutes: 90 };
}

export function ScheduleTemplatesManager({
  initialTemplates,
  groups,
  sports,
  workingDays,
}: {
  initialTemplates: ScheduleTemplateDto[];
  groups: ScheduleGroupOption[];
  sports: ScheduleSportOption[];
  workingDays: ClubDay[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showCreateForm, setShowCreateForm] = useState(initialTemplates.length === 0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplates[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<ScheduleSlotInput[]>([emptySlot()]);
  const [targetMode, setTargetMode] = useState<ScheduleTargetMode>("SELECTED_GROUPS");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [groupType, setGroupType] = useState<GroupTypeValue>("ADULTS");
  const [effectiveFrom, setEffectiveFrom] = useState(todayInputValue);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [confirmFutureSessions, setConfirmFutureSessions] = useState(false);
  const [preview, setPreview] = useState<ScheduleApplySummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates],
  );

  const workingDaySet = useMemo(() => new Set(workingDays), [workingDays]);
  const selectedTemplateClosedSlots = useMemo(
    () => selectedTemplate?.slots.filter((slot) => !workingDaySet.has(slot.dayOfWeek)).map(scheduleSlotLabel) ?? [],
    [selectedTemplate, workingDaySet],
  );
  const targetGroups = useMemo(() => {
    if (targetMode === "ALL_ACTIVE") return groups;
    if (targetMode === "SPORT") return groups.filter((group) => group.sportId === sportId);
    if (targetMode === "GROUP_TYPE") return groups.filter((group) => group.groupType === groupType);
    return groups.filter((group) => selectedGroupIds.includes(group.id));
  }, [groupType, groups, selectedGroupIds, sportId, targetMode]);
  const selectedTargetModeOption = useMemo(
    () => SCHEDULE_TARGET_MODE_OPTIONS.find((option) => option.value === targetMode) ?? SCHEDULE_TARGET_MODE_OPTIONS[0],
    [targetMode],
  );
  const targetLabel = useMemo(() => {
    if (targetMode === "ALL_ACTIVE") return "Tous les groupes actifs";
    if (targetMode === "SPORT") {
      return sports.find((sport) => sport.id === sportId)?.name ?? "Discipline sélectionnée";
    }
    if (targetMode === "GROUP_TYPE") {
      if (groupType === "KIDS") return "Groupes enfants";
      if (groupType === "MIXED") return "Groupes mixtes";
      return "Groupes adultes";
    }
    if (targetGroups.length === 0) return "Aucun groupe sélectionné";
    if (targetGroups.length === 1) return targetGroups[0]?.name ?? "Groupe sélectionné";
    return "Groupes sélectionnés";
  }, [groupType, sportId, sports, targetGroups, targetMode]);

  function clearApplyPreview() {
    setPreview(null);
    setConfirmFutureSessions(false);
  }

  function updateSlot(index: number, patch: Partial<ScheduleSlotInput>) {
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number) {
    setSlots((current) => (current.length === 1 ? current : current.filter((_, slotIndex) => slotIndex !== index)));
  }

  function toggleGroup(groupId: string) {
    clearApplyPreview();
    setSelectedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

  async function createTemplate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/schedule-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, slots }),
    });
    const json: { data?: ScheduleTemplateDto; error?: string } = await response.json();
    setLoading(false);

    if (!response.ok || !json.data) {
      setMessage(json.error ?? "Impossible de créer le modèle");
      return;
    }

    setTemplates((current) => [json.data!, ...current]);
    clearApplyPreview();
    setSelectedTemplateId(json.data.id);
    setName("");
    setDescription("");
    setSlots([emptySlot()]);
    setShowCreateForm(false);
    setMessage("Modèle créé");
  }

  async function archiveTemplate(templateId: string) {
    if (!window.confirm("Archiver ce modèle ? Les horaires déjà appliqués aux groupes ne seront pas modifiés.")) return;
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/schedule-templates/${templateId}`, { method: "DELETE" });
    const json: { error?: string } = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(json.error ?? "Impossible d'archiver le modèle");
      return;
    }

    setTemplates((current) => current.filter((template) => template.id !== templateId));
    if (selectedTemplateId === templateId) {
      clearApplyPreview();
      setSelectedTemplateId(templates.find((template) => template.id !== templateId)?.id ?? "");
    }
    setMessage("Modèle archivé");
  }

  function buildApplyPayload(dryRun: boolean) {
    return {
      targetMode,
      groupIds: selectedGroupIds,
      sportId,
      groupType,
      effectiveFrom: dateInputToIso(effectiveFrom),
      effectiveTo: effectiveTo ? dateInputToIso(effectiveTo) : null,
      replaceExisting,
      dryRun,
      confirmFutureSessions,
    };
  }

  async function previewApply() {
    if (!selectedTemplate) {
      setMessage("Sélectionnez un modèle");
      return;
    }
    if (targetGroups.length === 0) {
      setMessage("Choisissez au moins un groupe cible avant de prévisualiser.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setPreview(null);

    const response = await fetch(`/api/schedule-templates/${selectedTemplate.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildApplyPayload(true)),
    });
    const json: ApplyResponse = await response.json();
    setLoading(false);

    if (!response.ok || !json.data) {
      setMessage(json.error ?? "Impossible de préparer l'application");
      return;
    }

    setPreview(json.data.summary);
    setConfirmFutureSessions(json.data.summary.futureSessionsCount === 0);
  }

  async function applyTemplate() {
    if (!selectedTemplate) return;
    if (targetGroups.length === 0) {
      setMessage("Choisissez au moins un groupe cible avant d'appliquer les horaires.");
      return;
    }
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/schedule-templates/${selectedTemplate.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildApplyPayload(false)),
    });
    const json: ApplyResponse = await response.json();

    if (!response.ok || !json.data?.applied) {
      setLoading(false);
      if (json.data?.summary) setPreview(json.data.summary);
      setMessage(json.error ?? "Impossible d'appliquer le modèle");
      return;
    }

    let generatedCount = 0;
    if (autoGenerate && json.data.generation?.groupIds.length) {
      for (const groupId of json.data.generation.groupIds) {
        const generationResponse = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId, horizonDays: json.data.generation.horizonDays }),
        });
        const generationJson: { data?: { createdCount?: number } } = await generationResponse.json();
        generatedCount += generationJson.data?.createdCount ?? 0;
      }
    }

    setLoading(false);
    setPreview(json.data.summary);
    setMessage(
      `Modèle appliqué à ${json.data.summary.groupCount} groupe${json.data.summary.groupCount > 1 ? "s" : ""}. ${generatedCount} séance${generatedCount > 1 ? "s" : ""} générée${generatedCount > 1 ? "s" : ""}.`,
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ScheduleTemplateLibraryPanel
        templates={templates}
        selectedTemplateId={selectedTemplate?.id ?? null}
        showCreateForm={showCreateForm}
        name={name}
        description={description}
        slots={slots}
        loading={loading}
        onToggleCreateForm={() => setShowCreateForm((current) => !current)}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSlotChange={updateSlot}
        onSlotRemove={removeSlot}
        onSlotAdd={() => setSlots((current) => [...current, emptySlot()])}
        onCreateSubmit={createTemplate}
        onSelectTemplate={(templateId) => {
          clearApplyPreview();
          setSelectedTemplateId(templateId);
        }}
        onArchiveTemplate={(templateId) => void archiveTemplate(templateId)}
      />

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
              onChange={(event) => {
                clearApplyPreview();
                setSelectedTemplateId(event.target.value);
              }}
              className="field"
            >
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>

          {selectedTemplate ? <SelectedScheduleTemplateSummary template={selectedTemplate} /> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Cible</span>
              <select
                value={targetMode}
                onChange={(event) => {
                  clearApplyPreview();
                  setTargetMode(event.target.value as typeof targetMode);
                }}
                className="field"
              >
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
                <select
                  value={sportId}
                  onChange={(event) => {
                    clearApplyPreview();
                    setSportId(event.target.value);
                  }}
                  className="field"
                >
                  {sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
                </select>
              </label>
            ) : null}
            {targetMode === "GROUP_TYPE" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">Type</span>
                <select
                  value={groupType}
                  onChange={(event) => {
                    clearApplyPreview();
                    setGroupType(event.target.value as GroupTypeValue);
                  }}
                  className="field"
                >
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
                  <input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} className="size-4 accent-[var(--primary)]" />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{group.sportName}</span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            {targetGroups.length} groupe{targetGroups.length > 1 ? "s" : ""} cible{targetGroups.length > 1 ? "s" : ""}.
            {selectedTemplateClosedSlots.length > 0 ? (
              <span className="ml-1 font-semibold text-[var(--warning)]">
                Attention: {selectedTemplateClosedSlots.join(", ")} tombe{selectedTemplateClosedSlots.length > 1 ? "nt" : ""} sur un jour fermé.
              </span>
            ) : null}
          </div>

          <ScheduleApplySafetyCard
            selectedTemplateName={selectedTemplate?.name ?? null}
            targetLabel={targetLabel}
            targetCount={targetGroups.length}
            targetMode={targetMode}
            replaceExisting={replaceExisting}
            autoGenerate={autoGenerate}
            closedSlots={selectedTemplateClosedSlots}
            hasPreview={Boolean(preview)}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Appliquer à partir du</span>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => {
                  clearApplyPreview();
                  setEffectiveFrom(event.target.value);
                }}
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Fin optionnelle</span>
              <input
                type="date"
                value={effectiveTo}
                min={effectiveFrom}
                onChange={(event) => {
                  clearApplyPreview();
                  setEffectiveTo(event.target.value);
                }}
                className="field"
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => {
                  clearApplyPreview();
                  setReplaceExisting(event.target.checked);
                }}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>Fermer les horaires actifs/futurs des groupes cibles avant d&apos;ouvrir les nouveaux créneaux.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={autoGenerate} onChange={(event) => setAutoGenerate(event.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>Générer les séances manquantes après application des horaires.</span>
            </label>
            {preview?.futureSessionsCount ? (
              <label className="flex items-start gap-2 text-[var(--warning)]">
                <input type="checkbox" checked={confirmFutureSessions} onChange={(event) => setConfirmFutureSessions(event.target.checked)} className="mt-0.5 size-4 accent-[var(--warning)]" />
                <span>Je confirme: {preview.futureSessionsCount} séances futures existent déjà et resteront visibles.</span>
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void previewApply()} disabled={loading || !selectedTemplate} className="btn btn-ghost btn-block-mobile">
              <Eye className="size-4" />
              Prévisualiser l&apos;impact
            </button>
            <button
              type="button"
              onClick={() => void applyTemplate()}
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
    </div>
  );
}
