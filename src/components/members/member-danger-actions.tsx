"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function archiveMember() {
    const confirmed = window.confirm(
      `Confirmer la résiliation de ${memberName} ? Le dossier sera archivé (historique conservé).`,
    );
    if (!confirmed) return;

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

    setMessage("Membre résilié avec succès");
    setLoading(null);
    router.refresh();
  }

  async function deleteMember() {
    const confirmed = window.confirm(
      `Supprimer définitivement ${memberName} ? Cette action est irréversible (abonnements, présences, paiements liés).`,
    );
    if (!confirmed) return;

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
    <section className="panel border border-[var(--danger)]/25 p-5 md:col-span-3">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Gestion du dossier</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
        La résiliation archive le membre sans effacer l&apos;historique. La suppression définitive retire toutes les
        données associées.
      </p>

      <FeedbackMessage message={message} className="mt-3" />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={archiveMember}
          disabled={busy || status === "ARCHIVED"}
          className="btn btn-danger btn-block-mobile min-h-11 sm:w-auto"
        >
          {loading === "archive" ? "Résiliation…" : status === "ARCHIVED" ? "Déjà résilié" : "Résilier le membre"}
        </button>
        <button
          type="button"
          onClick={deleteMember}
          disabled={busy}
          className="btn btn-ghost btn-block-mobile min-h-11 border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 sm:w-auto"
        >
          {loading === "delete" ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </section>
  );
}
