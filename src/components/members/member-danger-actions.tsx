"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type MemberDangerActionsProps = {
  memberId: string;
  memberName: string;
  status: "ACTIVE" | "ARCHIVED";
};

export function MemberDangerActions({ memberId, memberName, status }: MemberDangerActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"archive" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"archive" | "delete" | null>(null);

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

  async function deleteMember() {
    setLoading("delete");
    setMessage(null);

    const response = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression");
      setLoading(null);
      return;
    }

    router.push("/members");
    router.refresh();
  }

  const busy = loading !== null;

  return (
    <section className="panel h-full min-w-0 border border-[var(--danger)]/25 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Gestion du dossier</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
        La résiliation archive le membre sans effacer l&apos;historique. La suppression définitive retire toutes les
        données associées.
      </p>

      <FeedbackMessage message={message} className="mt-3" />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => setPendingAction("archive")}
          disabled={busy || status === "ARCHIVED"}
          className="btn btn-danger btn-block-mobile min-h-11 sm:w-auto"
        >
          {loading === "archive" ? "Résiliation…" : status === "ARCHIVED" ? "Déjà résilié" : "Résilier le membre"}
        </button>
        <button
          type="button"
          onClick={() => setPendingAction("delete")}
          disabled={busy}
          className="btn btn-ghost btn-block-mobile min-h-11 border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 sm:w-auto"
        >
          {loading === "delete" ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>

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
        open={pendingAction === "delete"}
        title="Supprimer définitivement ce membre ?"
        description={`${memberName} et toutes les données associées seront supprimés. Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        loading={loading === "delete"}
        onCancel={() => setPendingAction(null)}
        onConfirm={deleteMember}
      />
    </section>
  );
}
