import type { SessionDto, SessionStatusDto } from "@/types/session";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { formatCoachOptionLabel } from "@/lib/coach-display";

export type SessionEditFormState = {
  sessionDate: string;
  coachId: string;
  room: string;
  startTime: string;
  endTime: string;
  status: SessionStatusDto | "";
  exceptionReason: string;
  changeReason: string;
  coachSportOverrideReason: string;
};

type CoachOption = {
  id: string;
  firstName: string;
  lastName: string;
  qualifiedSportIds: string[];
  qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
};

type SessionEditModalProps = {
  session: SessionDto;
  editForm: SessionEditFormState;
  editMode: "exception" | "permanent" | null;
  editMessage: string | null;
  editLoading: boolean;
  editingHasAttendances: boolean;
  needsCoachSportOverride: boolean;
  coachesOptions: CoachOption[];
  onFormChange: (patch: Partial<SessionEditFormState>) => void;
  onEditModeChange: (mode: "exception" | "permanent") => void;
  onClose: () => void;
  onSave: () => void;
};

export function SessionEditModal({
  session,
  editForm,
  editMode,
  editMessage,
  editLoading,
  editingHasAttendances,
  needsCoachSportOverride,
  coachesOptions,
  onFormChange,
  onEditModeChange,
  onClose,
  onSave,
}: SessionEditModalProps) {
  const saveDisabled =
    editLoading ||
    editingHasAttendances ||
    (editMode === "permanent" && editForm.changeReason.trim().length < 3) ||
    (editForm.status === "CANCELLED" && !editForm.exceptionReason.trim()) ||
    (needsCoachSportOverride && !editForm.coachSportOverrideReason.trim());

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
      <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-floating)] md:max-w-2xl md:rounded-lg">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Modifier la séance</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {session.groupName} — {new Date(session.sessionDate).toLocaleDateString("fr-FR")}
        </p>

        {editingHasAttendances ? (
          <p className="mt-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--foreground)]">
            Cette séance a {session.attendanceCount} pointage(s). Annulez les présences depuis le pointage du jour
            avant de modifier ou reporter.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Jour</label>
            <input
              type="date"
              value={editForm.sessionDate}
              onChange={(event) => onFormChange({ sessionDate: event.target.value })}
              disabled={editingHasAttendances}
              className="field text-sm"
            />
            {editMode === "permanent" ? (
              <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                Le jour et l&apos;heure choisis s&apos;appliquent à cette séance et à chaque semaine suivante (même jour de la semaine).
              </p>
            ) : (
              <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                Exception : tous les champs ne modifient que cette séance.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Coach de cette séance</label>
            <select
              value={editForm.coachId}
              onChange={(event) => onFormChange({ coachId: event.target.value })}
              disabled={editingHasAttendances}
              className="field text-sm"
            >
              <option value="">Aucun</option>
              {coachesOptions.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {formatCoachOptionLabel(coach)}
                </option>
              ))}
            </select>
            {needsCoachSportOverride ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                Coach hors qualification pour le sport du groupe. Motif admin obligatoire.
              </p>
            ) : null}
            <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
              Exception = cette séance seule. Permanent = ce créneau et les semaines suivantes.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Salle</label>
            <input
              value={editForm.room}
              onChange={(event) => onFormChange({ room: event.target.value })}
              disabled={editingHasAttendances}
              className="field text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Début</label>
            <input
              type="time"
              value={editForm.startTime}
              onChange={(event) => onFormChange({ startTime: event.target.value })}
              disabled={editingHasAttendances}
              className="field text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Fin</label>
            <input
              type="time"
              value={editForm.endTime}
              onChange={(event) => onFormChange({ endTime: event.target.value })}
              disabled={editingHasAttendances}
              className="field text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut</label>
            <select
              value={editForm.status}
              onChange={(event) => onFormChange({ status: event.target.value as SessionStatusDto })}
              disabled={editingHasAttendances}
              className="field text-sm"
            >
              <option value="PLANNED">Planifiée</option>
              <option value="RESCHEDULED">Reportée</option>
              <option value="CANCELLED">Annulée</option>
              {session.status === "COMPLETED" ? <option value="COMPLETED">Terminée</option> : null}
            </select>
            <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
              Une séance terminée se finalise depuis son écran de pointage.
            </p>
          </div>
          {editForm.status === "CANCELLED" ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Motif d&apos;annulation *</label>
              <input
                value={editForm.exceptionReason}
                onChange={(event) => onFormChange({ exceptionReason: event.target.value })}
                placeholder="Ex: férié, coach indisponible..."
                disabled={editingHasAttendances}
                className="field text-sm"
                required={editForm.status === "CANCELLED"}
              />
            </div>
          ) : null}
          {needsCoachSportOverride ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Motif admin d&apos;exception
              </label>
              <textarea
                value={editForm.coachSportOverrideReason}
                onChange={(event) => onFormChange({ coachSportOverrideReason: event.target.value })}
                maxLength={500}
                disabled={editingHasAttendances}
                className="field min-h-20 text-sm"
                required
              />
            </div>
          ) : null}
        </div>

        <FeedbackMessage message={editMessage} className="mt-3" />

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Type de modification</p>
          <div className="mb-4 grid gap-2 sm:flex sm:gap-2">
            <button
              type="button"
              onClick={() => onEditModeChange("exception")}
              disabled={editingHasAttendances}
              className={`rounded-lg border px-3 py-2.5 text-sm transition-colors sm:flex-1 disabled:opacity-50 ${
                editMode === "exception"
                  ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <span className="block font-medium">Exception</span>
              <span className="text-xs">Cette séance uniquement</span>
            </button>
            <button
              type="button"
              onClick={() => onEditModeChange("permanent")}
              disabled={editingHasAttendances}
              className={`rounded-lg border px-3 py-2.5 text-sm transition-colors sm:flex-1 disabled:opacity-50 ${
                editMode === "permanent"
                  ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <span className="block font-medium">Permanent</span>
              <span className="text-xs">Toutes les prochaines semaines</span>
            </button>
          </div>

          {editMode === "permanent" ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                Motif de modification permanente *
              </label>
              <textarea
                value={editForm.changeReason}
                onChange={(event) => onFormChange({ changeReason: event.target.value })}
                maxLength={500}
                disabled={editingHasAttendances}
                className="field min-h-20 bg-white text-sm text-[var(--foreground)]"
                placeholder="Ex: changement de saison, salle remplacée, nouveau créneau validé..."
                required
              />
              <p className="mt-1 text-xs leading-relaxed">
                Ce motif sera conservé dans le journal car la modification touche cette séance et les semaines suivantes.
              </p>
            </div>
          ) : null}

          <div className="form-actions border-t-0 pt-0">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-block-mobile">
              Annuler
            </button>
            <button type="button" onClick={onSave} disabled={saveDisabled} className="btn btn-primary btn-block-mobile">
              {editLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
