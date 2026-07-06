import type { SessionOption } from "@/components/settings/data-import-model";

export type DataImportAttendanceChoice = "PRESENT" | "ABSENT" | "NONE";
export type DataImportAttendanceStatuses = Record<string, "PRESENT" | "ABSENT">;

type DataImportAttendanceSectionProps = {
  eligibleSessions: SessionOption[];
  attendanceStatuses: DataImportAttendanceStatuses;
  onStatusChange: (sessionId: string, choice: DataImportAttendanceChoice) => void;
};

export function DataImportAttendanceSection({
  eligibleSessions,
  attendanceStatuses,
  onStatusChange,
}: DataImportAttendanceSectionProps) {
  return (
    <section id="reprise-attendance" className="form-section-anchor panel p-4 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">3. Semaine de bascule</p>
        <h2 className="mt-1 text-lg font-semibold">Pointages déjà réalisés sur papier</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Sélectionnez uniquement les séances antérieures à la bascule. Elles servent au quota hebdomadaire sans retirer
          une seconde fois les séances restantes.
        </p>
      </div>
      {eligibleSessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
          Aucune séance passée disponible cette semaine pour ce groupe.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {eligibleSessions.map((session) => {
            const selected = attendanceStatuses[session.id];
            return (
              <div key={session.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <p className="text-sm font-semibold">
                  {new Date(session.sessionDate).toLocaleDateString("fr-FR")} · {session.startTime}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["PRESENT", "ABSENT", "NONE"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onStatusChange(session.id, choice)}
                      className={`btn px-2 text-xs ${
                        choice === "NONE"
                          ? !selected
                            ? "btn-primary"
                            : "btn-ghost"
                          : selected === choice
                            ? "btn-primary"
                            : "btn-ghost"
                      }`}
                    >
                      {choice === "PRESENT" ? "Présent" : choice === "ABSENT" ? "Absent" : "Non saisi"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
