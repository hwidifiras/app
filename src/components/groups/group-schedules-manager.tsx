"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions, FormSectionNav } from "@/components/ui/form-layout";

type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

const dayOrder: DayOfWeekValue[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const dayLabels: Record<DayOfWeekValue, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

type ScheduleRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

type DaySelection = {
  day: DayOfWeekValue;
  checked: boolean;
  startTime: string;
};

type ScheduleStatus = "ACTIVE" | "FUTURE" | "PAST";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function inputDateToIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "Sans date de fin";
}

function daySortIndex(day: string) {
  const index = dayOrder.indexOf(day as DayOfWeekValue);
  return index === -1 ? 99 : index;
}

function getScheduleStatus(row: ScheduleRow, today = todayInputValue()): ScheduleStatus {
  const from = toDateInput(row.effectiveFrom);
  const to = toDateInput(row.effectiveTo);
  if (from && today < from) return "FUTURE";
  if (to && today > to) return "PAST";
  return "ACTIVE";
}

function statusLabel(status: ScheduleStatus) {
  if (status === "ACTIVE") return "Actuelle";
  if (status === "FUTURE") return "À venir";
  return "Terminée";
}

function statusClass(status: ScheduleStatus) {
  if (status === "ACTIVE") return "bg-[var(--success)]/10 text-[var(--success)]";
  if (status === "FUTURE") return "bg-[var(--primary)]/10 text-[var(--primary)]";
  return "bg-[var(--surface-soft)] text-[var(--muted-foreground)]";
}

function formatPeriod(from: string, to: string | null) {
  return `Du ${formatDate(from)} au ${formatDate(to)}`;
}

function emptyDaySelections(): DaySelection[] {
  return dayOrder.map((day) => ({
    day,
    checked: false,
    startTime: "18:00",
  }));
}

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
    const grouped = new Map<
      string,
      {
        key: string;
        effectiveFrom: string;
        effectiveTo: string | null;
        rows: ScheduleRow[];
        status: ScheduleStatus;
      }
    >();

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

    setSchedules((current) => current.filter((s) => s.id !== scheduleId));
    setPendingDeleteSchedule(null);
    setEditingSchedule(null);
    setMessage("Horaire supprimé.");
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

      <div id="schedule-current" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Périodes d&apos;horaires</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {schedulePeriods.length} période(s) · {schedules.length} horaire(s)
            </p>
          </div>
          {schedules.length > 0 ? (
            <button type="button" onClick={prefillFromCurrentPeriod} className="btn btn-ghost text-sm">
              Reprendre les horaires actuels
            </button>
          ) : null}
        </div>

        {schedulePeriods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6 text-center text-sm text-[var(--muted-foreground)]">
            Aucun horaire défini. Ajoutez une période avec les jours d&apos;entraînement du groupe.
          </div>
        ) : (
          <div className="space-y-3">
            {schedulePeriods.map((period) => (
              <section key={period.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      Période d&apos;application
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                      {formatPeriod(period.effectiveFrom, period.effectiveTo)}
                    </h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(period.status)}`}>
                    {statusLabel(period.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                  {period.rows.map((row) => {
                    const status = getScheduleStatus(row);
                    const expanded = expandedScheduleIds.includes(row.id);
                    return (
                      <article key={row.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">
                              {dayLabels[row.dayOfWeek as DayOfWeekValue] ?? row.dayOfWeek}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              {row.startTime} · {row.durationMinutes} min
                            </p>
                          </div>
                          <button
                            type="button"
                            className="mobile-card-toggle md:hidden"
                            onClick={() => toggleExpand(row.id)}
                            aria-expanded={expanded}
                          >
                            {expanded ? "Réduire" : "Infos"}
                            <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => startEditing(row)} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
                            Modifier
                          </button>
                          {status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => setPendingCloseSchedule(row)}
                              disabled={closingId !== null}
                              className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                            >
                              Arrêter aujourd&apos;hui
                            </button>
                          ) : null}
                          {status === "FUTURE" ? (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteSchedule(row)}
                              disabled={deletingId !== null}
                              className="btn btn-danger min-h-0 px-2 py-1 text-xs"
                            >
                              Retirer
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {editingSchedule ? (
        <div id="schedule-edit" className="rounded-lg border border-[var(--primary)]/25 bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Modification</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Modifier un horaire</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                La modification change la règle d&apos;horaire. Les séances déjà créées restent visibles dans le planning.
              </p>
            </div>
            <button type="button" onClick={() => setEditingSchedule(null)} className="btn btn-ghost text-sm">
              Annuler
            </button>
          </div>

          <form onSubmit={onUpdateSchedule} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Jour</label>
                <select
                  value={editDayOfWeek}
                  onChange={(event) => setEditDayOfWeek(event.target.value as DayOfWeekValue)}
                  className="field text-sm"
                >
                  {dayOrder.map((day) => (
                    <option key={day} value={day}>
                      {dayLabels[day]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Heure</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(event) => setEditStartTime(event.target.value)}
                  className="field text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Durée (min)</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  step={5}
                  value={editDurationMinutes}
                  onChange={(event) => setEditDurationMinutes(Number(event.target.value))}
                  className="field text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Appliqué du</label>
                <input
                  type="date"
                  value={editEffectiveFrom}
                  onChange={(event) => setEditEffectiveFrom(event.target.value)}
                  className="field text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Jusqu&apos;au</label>
                <input
                  type="date"
                  value={editEffectiveTo}
                  onChange={(event) => setEditEffectiveTo(event.target.value)}
                  className="field text-sm"
                />
              </div>
            </div>

            <FormActions sticky>
              <button
                type="button"
                onClick={() => setPendingDeleteSchedule(editingSchedule)}
                className="btn btn-danger btn-block-mobile"
              >
                Supprimer définitivement
              </button>
              <button type="submit" disabled={savingEditId !== null} className="btn btn-primary btn-block-mobile">
                {savingEditId ? "Enregistrement..." : "Enregistrer l'horaire"}
              </button>
            </FormActions>
          </form>
        </div>
      ) : null}

      <div id="schedule-new" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Nouvelle période d&apos;horaires</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Créez une période quand les horaires changent pour une saison, des vacances ou un cycle temporaire. Les dates
          appartiennent à cette période d&apos;horaires, pas au groupe.
        </p>

        <form onSubmit={onAddSchedules} className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Début de la période
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="field text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Fin de la période (optionnel)
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="field text-sm"
              />
              <p className="mt-1 text-[0.68rem] text-[var(--muted-foreground)]">
                Laisser vide si ces horaires restent actifs sans date de fin.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Durée par séance (min)
              </label>
              <input
                type="number"
                min={30}
                max={240}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="field text-sm"
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">Jours fixes de la semaine</p>
              {schedules.length > 0 ? (
                <button type="button" onClick={prefillFromCurrentPeriod} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
                  Copier les horaires actuels
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {daySelections.map((selection) => (
                <label
                  key={selection.day}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selection.checked
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selection.checked}
                    onChange={() => toggleDay(selection.day)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  <span className="flex-1 text-sm font-medium text-[var(--foreground)]">
                    {dayLabels[selection.day]}
                  </span>
                  {selection.checked && (
                    <input
                      type="time"
                      value={selection.startTime}
                      onChange={(e) => updateDayTime(selection.day, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="field w-[100px] text-sm"
                      required={selection.checked}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>

          <label className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(event) => setAutoGenerate(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-semibold text-[var(--foreground)]">Générer les séances après enregistrement</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                Crée les séances datées à venir pour le pointage. Décochez si vous voulez seulement préparer les horaires.
              </span>
            </span>
          </label>

          <FormActions sticky>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
              {loading ? "Enregistrement..." : autoGenerate ? "Enregistrer et générer les séances" : "Enregistrer la période"}
            </button>
          </FormActions>
        </form>

        <FeedbackMessage message={message} className="mt-3" />
      </div>

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
        title="Supprimer définitivement cet horaire ?"
        description={
          pendingDeleteSchedule
            ? `${dayLabels[pendingDeleteSchedule.dayOfWeek as DayOfWeekValue] ?? pendingDeleteSchedule.dayOfWeek} à ${pendingDeleteSchedule.startTime}. Préférez arrêter l'horaire si cette règle a déjà servi au planning.`
            : ""
        }
        confirmLabel="Supprimer définitivement"
        loading={deletingId === pendingDeleteSchedule?.id}
        onCancel={() => setPendingDeleteSchedule(null)}
        onConfirm={() => pendingDeleteSchedule ? onDeleteSchedule(pendingDeleteSchedule.id) : undefined}
      />
    </div>
  );
}
