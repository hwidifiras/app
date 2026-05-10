"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { StatusBadge } from "@/components/ui/status-badge";

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  totalSessions: number;
  sessionsPerWeek: number | null;
  validityDays: number;
  isActive: boolean;
  createdAt: string;
  sport: { id: string; name: string } | null;
  _count: { subscriptions: number };
};

export function SubscriptionPlansTable({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function deletePlan(planId: string) {
    const confirmed = window.confirm("Confirmer la suppression de ce plan ?");
    if (!confirmed) return;

    setLoadingId(planId);
    setMessage(null);

    const response = await fetch("/api/subscription-plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression");
      setLoadingId(null);
      return;
    }

    setMessage("Plan supprimé avec succès");
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div>
      <FeedbackMessage message={message} className="mb-3" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-(--surface-soft) text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nom</th>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Prix</th>
              <th className="px-4 py-3 text-center font-semibold">Séances</th>
              <th className="px-4 py-3 text-center font-semibold">Sem.</th>
              <th className="px-4 py-3 text-center font-semibold">Validité</th>
              <th className="px-4 py-3 text-center font-semibold">Sport</th>
              <th className="px-4 py-3 text-center font-semibold">Statut</th>
              <th className="px-4 py-3 text-center font-semibold">Souscriptions</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-(--surface-soft)">
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{plan.description ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(plan.price / 100)}
                </td>
                <td className="px-4 py-3 text-center">{plan.totalSessions}</td>
                <td className="px-4 py-3 text-center">{plan.sessionsPerWeek ?? "—"}</td>
                <td className="px-4 py-3 text-center">{plan.validityDays}j</td>
                <td className="px-4 py-3 text-center">{plan.sport?.name ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge variant={plan.isActive ? "success" : "muted"}>{plan.isActive ? "Actif" : "Inactif"}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-center">{plan._count.subscriptions}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/subscription-plans/${plan.id}/edit`} className="btn btn-ghost text-xs px-2 py-1 min-h-0">
                      Modifier
                    </Link>
                    <button
                      type="button"
                      onClick={() => deletePlan(plan.id)}
                      disabled={loadingId === plan.id}
                      className="btn btn-danger text-xs px-2 py-1 min-h-0"
                    >
                      {loadingId === plan.id ? "..." : "Supprimer"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}