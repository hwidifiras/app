import Link from "next/link";
import { CheckCircle2, Download, LockKeyhole, RotateCcw } from "lucide-react";

export type RecentImport = {
  id: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  canRollback: boolean;
  rollbackStatus: "AVAILABLE" | "ROLLED_BACK" | "LOCKED_BY_ACTIVITY" | "ALREADY_REMOVED" | "NOT_FOUND";
  rollbackReason: string;
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

const rollbackStatusLabels: Record<RecentImport["rollbackStatus"], string> = {
  AVAILABLE: "Annulable",
  ROLLED_BACK: "Déjà annulé",
  LOCKED_BY_ACTIVITY: "Verrouillé",
  ALREADY_REMOVED: "Données retirées",
  NOT_FOUND: "À vérifier",
};

const rollbackStatusStyles: Record<RecentImport["rollbackStatus"], string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ROLLED_BACK: "border-blue-200 bg-blue-50 text-blue-700",
  LOCKED_BY_ACTIVITY: "border-amber-200 bg-amber-50 text-amber-800",
  ALREADY_REMOVED: "border-slate-200 bg-slate-50 text-slate-600",
  NOT_FOUND: "border-red-200 bg-red-50 text-red-700",
};

function rollbackHelperText(item: RecentImport, modeActive: boolean) {
  if (item.canRollback && !modeActive) {
    return "Ouvrez le mode temporaire pour annuler cet import.";
  }
  return item.rollbackReason;
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
  const rollbackAvailableCount = status.recentImports.filter((item) => item.rollbackStatus === "AVAILABLE").length;
  const lockedCount = status.recentImports.filter((item) => item.rollbackStatus === "LOCKED_BY_ACTIVITY").length;
  const rolledBackCount = status.recentImports.filter((item) => item.rollbackStatus === "ROLLED_BACK").length;

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="font-semibold">Derniers imports</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        L&apos;annulation reste disponible seulement avant toute nouvelle présence, paiement, abonnement ou lien famille.
        Les lignes verrouillées se corrigent depuis les écrans métier pour garder la trace.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <RollbackMetric label="Total suivi" value={status.recentImports.length} />
        <RollbackMetric label="Annulables" value={rollbackAvailableCount} tone="success" />
        <RollbackMetric label="Verrouillés" value={lockedCount} tone="warning" />
        <RollbackMetric label="Déjà annulés" value={rolledBackCount} tone="info" />
      </div>
      <div className="mt-4 space-y-2">
        {status.recentImports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-center text-sm text-[var(--muted-foreground)]">
            Aucun import enregistré. Les reprises appliquées apparaîtront ici avec leur état d&apos;annulation.
          </div>
        ) : (
          status.recentImports.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3 shadow-[var(--shadow-panel)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{item.memberName}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${rollbackStatusStyles[item.rollbackStatus]}`}
                  >
                    {rollbackStatusLabels[item.rollbackStatus]}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(item.createdAt).toLocaleString("fr-FR")}
                </p>
                <p className="mt-1 max-w-2xl text-xs text-[var(--muted-foreground)]">
                  {rollbackHelperText(item, status.active)}
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
              ) : item.rollbackStatus === "LOCKED_BY_ACTIVITY" ? (
                <Link href={`/members/${item.memberId}`} className="btn btn-ghost">
                  Ouvrir la fiche
                </Link>
              ) : (
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Annulation indisponible
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RollbackMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "info"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
