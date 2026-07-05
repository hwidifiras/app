import { CheckCircle2, Download, LockKeyhole, RotateCcw } from "lucide-react";

export type RecentImport = {
  id: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  canRollback: boolean;
};

export type ImportStatus = {
  active: boolean;
  expiresAt: string | null;
  recentImports: RecentImport[];
};

export function DataImportModePanel({
  status,
  expiresLabel,
  busy,
  templateUrl,
  onToggleMode,
}: {
  status: ImportStatus;
  expiresLabel: string | null;
  busy: boolean;
  templateUrl: string;
  onToggleMode: () => void;
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-lg p-2.5 ${
              status.active
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
            }`}
          >
            {status.active ? <CheckCircle2 className="size-5" /> : <LockKeyhole className="size-5" />}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              {status.active ? "Import ancien fichier ouvert" : "Import ancien fichier fermé"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {status.active
                ? `Réservé à cet administrateur jusqu'à ${expiresLabel}.`
                : "Aucune donnée d'ancien registre ne peut être importée tant que ce mode est fermé."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!status.active ? (
            <a href={templateUrl} className="btn btn-ghost btn-block-mobile" download>
              <Download className="size-4" /> Télécharger le modèle
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onToggleMode}
            className={`btn ${status.active ? "btn-ghost" : "btn-primary"} btn-block-mobile`}
          >
            {status.active ? "Fermer maintenant" : "Activer pour 4 heures"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function RecentImportsPanel({
  status,
  busy,
  onRollback,
}: {
  status: ImportStatus;
  busy: boolean;
  onRollback: (auditLogId: string) => void;
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="font-semibold">Derniers imports</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        L&apos;annulation reste disponible seulement tant qu&apos;aucune nouvelle activité n&apos;est liée au membre.
      </p>
      <div className="mt-4 space-y-2">
        {status.recentImports.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Aucun import enregistré.</p>
        ) : (
          status.recentImports.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3 shadow-[var(--shadow-panel)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{item.memberName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(item.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              {item.canRollback && status.active ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRollback(item.id)}
                  className="btn btn-ghost text-[var(--danger)]"
                >
                  <RotateCcw className="size-4" /> Annuler l&apos;import
                </button>
              ) : (
                <span className="text-xs text-[var(--muted-foreground)]">Annulation indisponible</span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
