const enrollmentStepLabels = ["Élèves", "Offre", "Devis"];

export function EnrollmentStepper({ step }: { step: number }) {
  return (
    <div className="enrollment-stepper grid grid-cols-3 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 shadow-[var(--shadow-panel)]">
      {enrollmentStepLabels.map((label, index) => {
        const itemStep = index + 1;
        const active = step === itemStep;
        const done = step > itemStep;
        return (
          <div
            key={label}
            aria-current={active ? "step" : undefined}
            className={`rounded-lg border px-2 py-2 text-center text-xs font-bold transition ${
              active
                ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[var(--shadow-panel)]"
                : done
                  ? "border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-transparent bg-[var(--surface-raised)] text-[var(--muted-foreground)]"
            }`}
          >
            <span className="block text-[0.62rem] opacity-80">{done ? "Terminée" : `Étape ${itemStep}`}</span>
            {label}
          </div>
        );
      })}
    </div>
  );
}
