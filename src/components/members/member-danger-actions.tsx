"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type MemberDangerActionsProps = {
  memberId: string;
  memberName: string;
  status: "ACTIVE" | "ARCHIVED";
  canPermanentDelete?: boolean;
};

type DangerAction = "archive" | "permanent";

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
}: MemberDangerActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<DangerAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DangerAction | null>(null);

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
    </section>
  );
}
