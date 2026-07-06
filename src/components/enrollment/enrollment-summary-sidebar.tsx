export type EnrollmentLineSummary = {
  key: string;
  title: string;
  groupName: string;
  planName: string;
  missing: string[];
  issue: string | null | undefined;
};

type EnrollmentSummarySidebarProps = {
  step: number;
  lineSummaries: EnrollmentLineSummary[];
  missingSummary: string[];
  offerName: string;
  quoteTotalLabel: string;
  quotePaidLabel: string;
  quoteBalanceLabel: string;
  hasQuote: boolean;
  hasBalanceDue: boolean;
};

export function EnrollmentSummarySidebar({
  step,
  lineSummaries,
  missingSummary,
  offerName,
  quoteTotalLabel,
  quotePaidLabel,
  quoteBalanceLabel,
  hasQuote,
  hasBalanceDue,
}: EnrollmentSummarySidebarProps) {
  return (
    <aside className="order-first rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] lg:sticky lg:top-20 lg:order-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Résumé</p>
          <h2 className="mt-1 text-base font-semibold">Inscription en cours</h2>
        </div>
        <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
          Étape {step}/3
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {lineSummaries.map((line) => (
          <div key={line.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{line.title}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                  line.missing.length ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                }`}
              >
                {line.missing.length ? "À compléter" : "Prêt"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{line.groupName}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{line.planName}</p>
            {line.issue ? <p className="mt-2 text-xs font-medium text-red-600">{line.issue}</p> : null}
          </div>
        ))}
      </div>

      {missingSummary.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-bold">À compléter</p>
          <ul className="mt-1 space-y-1">
            {missingSummary.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-900">
          Les lignes sont prêtes pour le devis.
        </div>
      )}

      <dl className="mt-4 divide-y divide-[var(--border)] text-sm">
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-[var(--muted-foreground)]">Offre</dt>
          <dd className="text-right font-medium">{offerName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-[var(--muted-foreground)]">Total devis</dt>
          <dd className="text-right font-bold">{quoteTotalLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-[var(--muted-foreground)]">À encaisser</dt>
          <dd className="text-right font-bold text-[var(--primary)]">{quotePaidLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-[var(--muted-foreground)]">Reste après paiement</dt>
          <dd className={`text-right font-bold ${hasQuote && hasBalanceDue ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
            {quoteBalanceLabel}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
