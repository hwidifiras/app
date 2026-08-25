"use client";

import { AlertTriangle, CheckCircle2, Info, UserCheck } from "lucide-react";

import { formatCoachName, isCoachQualifiedForSport } from "@/lib/coach-display";
import { cn } from "@/lib/utils";
import type { CoachDto } from "@/types/coach";

type GroupCoachEligibilityProps = {
  coaches: CoachDto[];
  selectedCoach: CoachDto | undefined;
  selectedSportId: string;
  selectedSportName?: string | null;
  onSelectCoach: (coachId: string) => void;
};

function coachLoadLabel(coach: CoachDto) {
  if (coach.weeklyScheduleCount === 0) return "disponible";
  if (coach.weeklyScheduleCount <= 3) return `${coach.weeklyScheduleCount} créneau(x)`;
  return `${coach.weeklyScheduleCount} créneaux, chargé`;
}

function coachSpecialtyLabel(coach: CoachDto) {
  return coach.qualifiedSports.map((sport) => sport.name).join(", ") || coach.sportName || "Spécialité à compléter";
}

export function GroupCoachEligibility({
  coaches,
  selectedCoach,
  selectedSportId,
  selectedSportName,
  onSelectCoach,
}: GroupCoachEligibilityProps) {
  const hasSport = selectedSportId.trim().length > 0;
  const compatibleCoaches = hasSport
    ? coaches.filter((coach) => isCoachQualifiedForSport(coach, selectedSportId))
    : coaches;
  const exceptionCoaches = hasSport
    ? coaches.filter((coach) => !isCoachQualifiedForSport(coach, selectedSportId))
    : [];
  const selectedIsCompatible = isCoachQualifiedForSport(selectedCoach, selectedSportId);

  return (
    <div className="@container/coach-eligibility mt-3 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <div className="flex min-w-0 flex-col gap-3 @xl/coach-eligibility:flex-row @xl/coach-eligibility:items-start @xl/coach-eligibility:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Compatibilité coach
          </p>
          {selectedCoach ? (
            <div className="mt-2 flex items-start gap-2">
              {selectedIsCompatible ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[var(--foreground)]">
                  {formatCoachName(selectedCoach)}
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                      selectedIsCompatible ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {selectedIsCompatible ? "Compatible" : "Exception admin"}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {coachSpecialtyLabel(selectedCoach)} · {selectedCoach.activeGroupCount} cours actif(s) ·{" "}
                  {coachLoadLabel(selectedCoach)}
                </p>
                {!selectedIsCompatible ? (
                  <p className="mt-1 text-xs leading-relaxed text-amber-700">
                    Ce coach n&apos;est pas autorisé pour {selectedSportName ?? "cette discipline"}. Un motif admin sera
                    enregistré avant de sauvegarder.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
              <p>
                Choisissez {hasSport ? "un coach compatible" : "une discipline puis un coach"} pour éviter les
                exceptions au planning.
              </p>
            </div>
          )}
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-xs @xl/coach-eligibility:w-auto @xl/coach-eligibility:min-w-48">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="font-bold text-emerald-800">{compatibleCoaches.length}</p>
            <p className="text-emerald-700">compatible(s)</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="font-bold text-amber-800">{exceptionCoaches.length}</p>
            <p className="text-amber-700">à justifier</p>
          </div>
        </div>
      </div>

      {hasSport ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">Suggestions pour ce cours</p>
          {compatibleCoaches.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {compatibleCoaches.slice(0, 5).map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => onSelectCoach(coach.id)}
                  className={cn(
                    "inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    selectedCoach?.id === coach.id
                      ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-blue-200 hover:bg-blue-50",
                  )}
                >
                  <UserCheck className="size-3.5" />
                  <span>{formatCoachName(coach)}</span>
                  <span className="font-medium text-[var(--muted-foreground)]">{coachLoadLabel(coach)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Aucun coach n&apos;est qualifié pour {selectedSportName ?? "cette discipline"}. Complétez les spécialités
              dans la page Coachs ou utilisez une exception admin.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
