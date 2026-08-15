"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

type MemberDangerActionsProps = {
  memberId: string;
  memberName: string;
  status: "ACTIVE" | "ARCHIVED";
  canPermanentDelete?: boolean;
  canTechnicalPurge?: boolean;
};

type DangerAction = "archive" | "permanent" | "technical-purge";

function permanentDeleteMessage(result: { error?: string; details?: { blockers?: Record<string, number> } }) {
  const blockers = result.details?.blockers;
  if (!blockers) return result.error ?? "Erreur lors de la suppression définitive";

  const labels: Record<string, string> = {
    attendances: "pointage(s)",
    payments: "paiement(s)",
    receipts: "recu(s)",
  };
  const activeBlockers = Object.entries(blockers)
    .filter(([key, value]) => key in labels && value > 0)
    .map(([key, value]) => `${value} ${labels[key] ?? key}`);

  if (activeBlockers.length === 0) return result.error ?? "Suppression bloquée";
  return `${result.error ?? "Suppression bloquée"} Historique détecté : ${activeBlockers.join(", ")}.`;
}

export function MemberDangerActions({
  memberId,
  memberName,
  status,
  canPermanentDelete = false,
  canTechnicalPurge = false,
}: MemberDangerActionsProps) {
  const purgeTitleId = useId();
  const purgeConfirmationRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState<DangerAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DangerAction | null>(null);
  const [technicalConfirmation, setTechnicalConfirmation] = useState("");
  const purgeDialogRef = useAccessibleDialog<HTMLElement>({
    open: pendingAction === "technical-purge",
    onClose: () => setPendingAction(null),
    closeOnEscape: loading !== "technical-purge",
    initialFocusRef: purgeConfirmationRef,
  });
  const [technicalReason, setTechnicalReason] = useState("Données de test à retirer des chiffres réels du club");

  async function archiveMember() {
    setLoading("archive");
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la résiliation");
      setLoading(null);
      return;
    }

    setPendingAction(null);
    setMessage("Membre résilié avec succès");
    setLoading(null);
    router.refresh();
  }

  async function permanentlyDeleteMember() {
    setLoading("permanent");
    setMessage(null);

    const response = await fetch(`/api/members/${encodeURIComponent(memberId)}?mode=permanent`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(permanentDeleteMessage(result));
      setLoading(null);
      return;
    }

    setPendingAction(null);
    setMessage("Membre supprimé définitivement");
    setLoading(null);
    router.push("/members");
    router.refresh();
  }

  async function purgeTechnicalTestMember() {
    setLoading("technical-purge");
    setMessage(null);

    const response = await fetch(`/api/members/${encodeURIComponent(memberId)}?mode=test-purge`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation: technicalConfirmation,
        reason: technicalReason,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la purge technique");
      setLoading(null);
      return;
    }

    setPendingAction(null);
    setMessage("Données de test purgées des chiffres du club");
    setLoading(null);
    router.push("/members");
    router.refresh();
  }

  const busy = loading !== null;

  return (
    <section className="panel h-full min-w-0 border border-[var(--danger)]/25 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Gestion du dossier</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
        La résiliation archive le membre sans effacer l&apos;historique, les abonnements ou les paiements.
      </p>

      <FeedbackMessage message={message} className="mt-3" />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => setPendingAction("archive")}
          disabled={busy || status === "ARCHIVED"}
          className="btn btn-danger btn-block-mobile min-h-11 sm:w-auto"
        >
          {loading === "archive" ? "Résiliation..." : status === "ARCHIVED" ? "Déjà résilié" : "Résilier le membre"}
        </button>
        {canPermanentDelete ? (
          <button
            type="button"
            onClick={() => setPendingAction("permanent")}
            disabled={busy}
            className="btn btn-ghost btn-block-mobile min-h-11 border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10 sm:w-auto"
          >
            {loading === "permanent" ? "Suppression..." : "Supprimer définitivement"}
          </button>
        ) : null}
        {canTechnicalPurge && status === "ARCHIVED" ? (
          <button
            type="button"
            onClick={() => {
              setTechnicalConfirmation("");
              setPendingAction("technical-purge");
            }}
            disabled={busy}
            className="btn btn-danger btn-block-mobile min-h-11 sm:w-auto"
          >
            {loading === "technical-purge" ? "Purge..." : "Purger données de test"}
          </button>
        ) : null}
      </div>

      {canPermanentDelete ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
          Suppression définitive admin pour doublon ou donnée de test. Elle supprime aussi les affectations et abonnements
          sans paiement, mais reste bloquée si le membre a un pointage, un paiement ou un reçu.
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingAction === "archive"}
        title="Résilier ce membre ?"
        description={`${memberName} sera archivé. Son historique, ses abonnements et ses paiements resteront consultables.`}
        confirmLabel="Résilier"
        loading={loading === "archive"}
        onCancel={() => setPendingAction(null)}
        onConfirm={archiveMember}
      />
      <ConfirmDialog
        open={pendingAction === "permanent"}
        title="Supprimer définitivement ce membre ?"
        description={`${memberName} sera effacé si aucun pointage, paiement ou reçu n'existe. Les affectations et abonnements sans paiement seront nettoyés aussi.`}
        confirmLabel="Supprimer"
        loading={loading === "permanent"}
        onCancel={() => setPendingAction(null)}
        onConfirm={permanentlyDeleteMember}
      />
      {pendingAction === "technical-purge" ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setPendingAction(null);
          }}
        >
          <section
            ref={purgeDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={purgeTitleId}
            tabIndex={-1}
            className="max-h-[min(90dvh,40rem)] w-full overflow-y-auto rounded-t-lg border border-[var(--danger)]/30 bg-[var(--surface)] p-4 shadow-[var(--shadow-floating)] sm:max-w-lg sm:rounded-lg sm:p-5"
          >
            <h2 id={purgeTitleId} className="text-base font-semibold text-[var(--danger)]">
              Purge technique de données de test
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Cette action supprime le membre résilié et ses traces de test: pointages, abonnements, paiements, reçus,
              affectations et logs liés. Les chiffres du club seront recalculés comme si ce test n&apos;avait jamais existé.
            </p>
            <div className="mt-4 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-3 text-sm leading-6 text-[var(--danger)]">
              À utiliser uniquement pour vos données de test. Ne pas utiliser pour un vrai adhérent.
            </div>
            <label className="mt-4 block text-sm font-medium">
              Motif technique
              <textarea
                className="field mt-1 min-h-20"
                value={technicalReason}
                onChange={(event) => setTechnicalReason(event.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Tapez exactement <span className="font-bold">{memberName}</span>
              <input
                ref={purgeConfirmationRef}
                className="field mt-1"
                value={technicalConfirmation}
                onChange={(event) => setTechnicalConfirmation(event.target.value)}
              />
            </label>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void purgeTechnicalTestMember()}
                disabled={loading === "technical-purge" || technicalConfirmation.trim() !== memberName.trim()}
                className="btn btn-danger min-h-11 sm:min-w-40"
              >
                {loading === "technical-purge" ? "Purge..." : "Purger le test"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={loading === "technical-purge"}
                className="btn btn-ghost min-h-11 sm:min-w-28"
              >
                Annuler
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
