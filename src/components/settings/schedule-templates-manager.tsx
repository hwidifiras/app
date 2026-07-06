"use client";

import { FormEvent, useMemo, useState } from "react";

import type { ClubDay } from "@/lib/club-working-days";
import type { GroupTypeValue } from "@/lib/demographics";
import { ScheduleTemplateApplyPanel } from "@/components/settings/schedule-template-apply-panel";
import { ScheduleTemplateLibraryPanel } from "@/components/settings/schedule-template-library-panel";
import {
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

      <ScheduleTemplateApplyPanel
        message={message}
        templates={templates}
        selectedTemplate={selectedTemplate}
        targetMode={targetMode}
        sports={sports}
        groups={groups}
        selectedGroupIds={selectedGroupIds}
        sportId={sportId}
        groupType={groupType}
        targetLabel={targetLabel}
        targetCount={targetGroups.length}
        selectedTemplateClosedSlots={selectedTemplateClosedSlots}
        effectiveFrom={effectiveFrom}
        effectiveTo={effectiveTo}
        replaceExisting={replaceExisting}
        autoGenerate={autoGenerate}
        confirmFutureSessions={confirmFutureSessions}
        preview={preview}
        loading={loading}
        onSelectTemplate={(templateId) => {
          clearApplyPreview();
          setSelectedTemplateId(templateId);
        }}
        onTargetModeChange={(mode) => {
          clearApplyPreview();
          setTargetMode(mode);
        }}
        onSportChange={(nextSportId) => {
          clearApplyPreview();
          setSportId(nextSportId);
        }}
        onGroupTypeChange={(nextGroupType) => {
          clearApplyPreview();
          setGroupType(nextGroupType);
        }}
        onToggleGroup={toggleGroup}
        onEffectiveFromChange={(value) => {
          clearApplyPreview();
          setEffectiveFrom(value);
        }}
        onEffectiveToChange={(value) => {
          clearApplyPreview();
          setEffectiveTo(value);
        }}
        onReplaceExistingChange={(checked) => {
          clearApplyPreview();
          setReplaceExisting(checked);
        }}
        onAutoGenerateChange={setAutoGenerate}
        onConfirmFutureSessionsChange={setConfirmFutureSessions}
        onPreviewApply={() => void previewApply()}
        onApplyTemplate={() => void applyTemplate()}
      />
    </div>
  );
}
