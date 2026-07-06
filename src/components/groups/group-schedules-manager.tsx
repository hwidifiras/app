"use client";

import { FormEvent, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSectionNav } from "@/components/ui/form-layout";
import { GroupScheduleEditPanel } from "@/components/groups/group-schedule-edit-panel";
import { GroupScheduleNewPeriodForm } from "@/components/groups/group-schedule-new-period-form";
import {
  GroupSchedulePeriods,
  type SchedulePeriod,
} from "@/components/groups/group-schedule-periods";
import {
  dayLabels,
  dayOrder,
  daySortIndex,
  emptyDaySelections,
  getScheduleStatus,
  inputDateToIso,
  todayInputValue,
  toDateInput,
  type DayOfWeekValue,
  type DaySelection,
  type ScheduleRow,
  type ScheduleStatus,
} from "@/components/groups/group-schedule-model";

export function GroupSchedulesManager({
  groupId,
  initialSchedules,
}: {
  groupId: string;
  initialSchedules: ScheduleRow[];
}) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>(initialSchedules);
  const [daySelections, setDaySelections] = useState<DaySelection[]>(emptyDaySelections);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [effectiveFrom, setEffectiveFrom] = useState(todayInputValue);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<string[]>([]);
  const [pendingDeleteSchedule, setPendingDeleteSchedule] = useState<ScheduleRow | null>(null);
  const [pendingCloseSchedule, setPendingCloseSchedule] = useState<ScheduleRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null);
  const [editDayOfWeek, setEditDayOfWeek] = useState<DayOfWeekValue>("MONDAY");
  const [editStartTime, setEditStartTime] = useState("18:00");
  const [editDurationMinutes, setEditDurationMinutes] = useState(90);
  const [editEffectiveFrom, setEditEffectiveFrom] = useState(todayInputValue);
  const [editEffectiveTo, setEditEffectiveTo] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const schedulePeriods = useMemo(() => {
    const grouped = new Map<string, SchedulePeriod>();

    for (const row of schedules) {
      const from = toDateInput(row.effectiveFrom);
      const to = toDateInput(row.effectiveTo) || null;
      const key = `${from}|${to ?? "open"}`;
      const current = grouped.get(key) ?? {
        key,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        rows: [],
        status: getScheduleStatus(row),
      };
      current.rows.push(row);
      current.status = current.rows.some((item) => getScheduleStatus(item) === "ACTIVE")
        ? "ACTIVE"
        : current.rows.some((item) => getScheduleStatus(item) === "FUTURE")
          ? "FUTURE"
          : "PAST";
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((period) => ({
        ...period,
        rows: [...period.rows].sort((a, b) => {
          const dayDiff = daySortIndex(a.dayOfWeek) - daySortIndex(b.dayOfWeek);
          return dayDiff === 0 ? a.startTime.localeCompare(b.startTime) : dayDiff;
        }),
      }))
      .sort((a, b) => {
        const statusRank: Record<ScheduleStatus, number> = { ACTIVE: 0, FUTURE: 1, PAST: 2 };
        const rankDiff = statusRank[a.status] - statusRank[b.status];
        return rankDiff === 0 ? toDateInput(a.effectiveFrom).localeCompare(toDateInput(b.effectiveFrom)) : rankDiff;
      });
  }, [schedules]);

  const activeSchedules = useMemo(
    () => schedules.filter((row) => getScheduleStatus(row) === "ACTIVE"),
    [schedules],
  );

  function toggleExpand(scheduleId: string) {
    setExpandedScheduleIds((current) =>
      current.includes(scheduleId) ? current.filter((id) => id !== scheduleId) : [...current, scheduleId],
    );
  }

  function toggleDay(day: DayOfWeekValue) {
    setDaySelections((prev) =>
      prev.map((d) => (d.day === day ? { ...d, checked: !d.checked } : d)),
    );
  }

  function updateDayTime(day: DayOfWeekValue, time: string) {
    setDaySelections((prev) =>
      prev.map((d) => (d.day === day ? { ...d, startTime: time } : d)),
    );
  }

  function prefillFromCurrentPeriod() {
    const source = activeSchedules.length > 0 ? activeSchedules : schedulePeriods[0]?.rows ?? [];
    if (source.length === 0) {
      setMessage("Aucun horaire existant à reprendre.");
      return;
    }

    const sourceByDay = new Map(source.map((row) => [row.dayOfWeek, row]));
    setDaySelections(
      dayOrder.map((day) => {
        const row = sourceByDay.get(day);
        return {
          day,
          checked: Boolean(row),
          startTime: row?.startTime ?? "18:00",
        };
      }),
    );
    setDurationMinutes(source[0]?.durationMinutes ?? 90);
    setEffectiveFrom(todayInputValue());
    setEffectiveTo("");
    setMessage("Horaires repris. Vérifiez les dates avant d'enregistrer la nouvelle période.");
  }

  function startEditing(row: ScheduleRow) {
    setEditingSchedule(row);
    setEditDayOfWeek(row.dayOfWeek as DayOfWeekValue);
    setEditStartTime(row.startTime);
    setEditDurationMinutes(row.durationMinutes);
    setEditEffectiveFrom(toDateInput(row.effectiveFrom) || todayInputValue());
    setEditEffectiveTo(toDateInput(row.effectiveTo));
    setMessage(null);
  }

  async function onAddSchedules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const selected = daySelections.filter((d) => d.checked);
    if (selected.length === 0) {
      setMessage("Veuillez sélectionner au moins un jour.");
      setLoading(false);
      return;
    }

    if (!effectiveFrom) {
      setMessage("Choisissez la date de début de cette période d'horaires.");
      setLoading(false);
      return;
    }

    const body = {
      schedules: selected.map((s) => ({
        dayOfWeek: s.day,
        startTime: s.startTime,
        durationMinutes,
        effectiveFrom: inputDateToIso(effectiveFrom),
        effectiveTo: effectiveTo ? inputDateToIso(effectiveTo) : undefined,
      })),
      autoGenerate,
      horizonDays: 90,
    };

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'ajout des horaires.");
      setLoading(false);
      return;
    }

    setSchedules((current) => [...current, ...result.data]);
    const generatedText = autoGenerate
      ? ` — ${result.sessions?.createdCount ?? 0} séance(s) générée(s)`
      : " — séances non générées";
    setMessage(`${result.data?.length ?? 0} horaire(s) ajouté(s)${generatedText}.`);
    setLoading(false);
    setDaySelections(emptyDaySelections());
    setDurationMinutes(90);
    setEffectiveFrom(todayInputValue());
    setEffectiveTo("");
    setAutoGenerate(true);
  }

  async function onUpdateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSchedule) return;
    if (!editEffectiveFrom) {
      setMessage("Choisissez la date de début de cet horaire.");
      return;
    }

    setSavingEditId(editingSchedule.id);
    setMessage(null);

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleId: editingSchedule.id,
        dayOfWeek: editDayOfWeek,
        startTime: editStartTime,
        durationMinutes: editDurationMinutes,
        effectiveFrom: inputDateToIso(editEffectiveFrom),
        effectiveTo: editEffectiveTo ? inputDateToIso(editEffectiveTo) : null,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification de l'horaire.");
      setSavingEditId(null);
      return;
    }

    setSchedules((current) => current.map((row) => (row.id === editingSchedule.id ? result.data : row)));
    setEditingSchedule(null);
    setSavingEditId(null);
    setMessage("Horaire modifié. Les séances déjà générées ne sont pas réécrites automatiquement.");
  }

  async function onCloseSchedule(schedule: ScheduleRow) {
    const today = todayInputValue();
    setClosingId(schedule.id);
    setMessage(null);

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleId: schedule.id,
        effectiveTo: inputDateToIso(today),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'arrêt de l'horaire.");
      setClosingId(null);
      return;
    }

    setSchedules((current) => current.map((row) => (row.id === schedule.id ? result.data : row)));
    setPendingCloseSchedule(null);
    setClosingId(null);
    setMessage("Horaire arrêté à aujourd'hui. L'historique reste conservé.");
  }

  async function onDeleteSchedule(scheduleId: string) {
    setDeletingId(scheduleId);
    setMessage(null);
    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId }),
    });

    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error ?? "Erreur lors de la suppression.");
      setDeletingId(null);
      return;
    }

    const result = await response.json();
    setSchedules((current) => current.map((row) => (row.id === scheduleId ? result.data : row)));
    setPendingDeleteSchedule(null);
    setEditingSchedule(null);
    setMessage("Horaire retiré sans supprimer l'historique.");
    setDeletingId(null);
  }

  return (
    <div className="space-y-5">
      <FormSectionNav
        items={[
          { href: "#schedule-current", label: "Périodes" },
          { href: "#schedule-new", label: "Nouvelle période" },
        ]}
      />

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Logique planning</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Horaires du groupe</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
          Cette page définit les horaires fixes du groupe par période. Le planning crée ensuite des séances datées à partir
          de ces horaires. Pour une saison, un Ramadan ou un changement d&apos;été, ajoutez une nouvelle période au lieu de
          modifier l&apos;historique.
        </p>
      </div>

      <GroupSchedulePeriods
        periods={schedulePeriods}
        scheduleCount={schedules.length}
        expandedScheduleIds={expandedScheduleIds}
        closingId={closingId}
        deletingId={deletingId}
        onPrefillFromCurrent={prefillFromCurrentPeriod}
        onToggleExpand={toggleExpand}
        onEdit={startEditing}
        onQueueClose={setPendingCloseSchedule}
        onQueueDelete={setPendingDeleteSchedule}
      />

      {editingSchedule ? (
        <GroupScheduleEditPanel
          schedule={editingSchedule}
          dayOfWeek={editDayOfWeek}
          startTime={editStartTime}
          durationMinutes={editDurationMinutes}
          effectiveFrom={editEffectiveFrom}
          effectiveTo={editEffectiveTo}
          savingEditId={savingEditId}
          onSubmit={onUpdateSchedule}
          onCancel={() => setEditingSchedule(null)}
          onQueueDelete={setPendingDeleteSchedule}
          onDayOfWeekChange={setEditDayOfWeek}
          onStartTimeChange={setEditStartTime}
          onDurationMinutesChange={setEditDurationMinutes}
          onEffectiveFromChange={setEditEffectiveFrom}
          onEffectiveToChange={setEditEffectiveTo}
        />
      ) : null}
      <GroupScheduleNewPeriodForm
        daySelections={daySelections}
        schedulesCount={schedules.length}
        durationMinutes={durationMinutes}
        effectiveFrom={effectiveFrom}
        effectiveTo={effectiveTo}
        autoGenerate={autoGenerate}
        loading={loading}
        message={message}
        onSubmit={onAddSchedules}
        onPrefillFromCurrent={prefillFromCurrentPeriod}
        onToggleDay={toggleDay}
        onUpdateDayTime={updateDayTime}
        onDurationMinutesChange={setDurationMinutes}
        onEffectiveFromChange={setEffectiveFrom}
        onEffectiveToChange={setEffectiveTo}
        onAutoGenerateChange={setAutoGenerate}
      />
      <ConfirmDialog
        open={pendingCloseSchedule !== null}
        title="Arrêter cet horaire aujourd'hui ?"
        description={
          pendingCloseSchedule
            ? `${dayLabels[pendingCloseSchedule.dayOfWeek as DayOfWeekValue] ?? pendingCloseSchedule.dayOfWeek} à ${pendingCloseSchedule.startTime}. L'horaire sera fermé sans supprimer l'historique.`
            : ""
        }
        confirmLabel="Arrêter l'horaire"
        loading={closingId === pendingCloseSchedule?.id}
        onCancel={() => setPendingCloseSchedule(null)}
        onConfirm={() => pendingCloseSchedule ? onCloseSchedule(pendingCloseSchedule) : undefined}
      />

      <ConfirmDialog
        open={pendingDeleteSchedule !== null}
        title="Retirer cet horaire ?"
        description={
          pendingDeleteSchedule
            ? `${dayLabels[pendingDeleteSchedule.dayOfWeek as DayOfWeekValue] ?? pendingDeleteSchedule.dayOfWeek} à ${pendingDeleteSchedule.startTime}. L'horaire sera fermé et restera visible dans l'historique.`
            : ""
        }
        confirmLabel="Retirer l'horaire"
        loading={deletingId === pendingDeleteSchedule?.id}
        onCancel={() => setPendingDeleteSchedule(null)}
        onConfirm={() => pendingDeleteSchedule ? onDeleteSchedule(pendingDeleteSchedule.id) : undefined}
      />
    </div>
  );
}
