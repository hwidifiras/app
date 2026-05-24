"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
  createdAt: string | Date;
  sport: { id: string; name: string } | null;
  _count: { subscriptions: number };
};

export function SubscriptionPlansTable({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function toggleExpand(planId: string) {
    setExpandedPlanIds((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
    );
  }

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
      <div className="data-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-(--surface-soft) text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nom</th>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Prix</th>
              <th className="px-4 py-3 text-center font-semibold">/ semaine</th>
              <th className="px-4 py-3 text-center font-semibold">/ mois (×4)</th>
              <th className="px-4 py-3 text-center font-semibold">Validité</th>
              <th className="px-4 py-3 text-center font-semibold">Sport</th>
              <th className="px-4 py-3 text-center font-semibold">Statut</th>
              <th className="px-4 py-3 text-center font-semibold">Souscriptions</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={`mobile-collapsible-row hover:bg-(--surface-soft) ${expandedPlanIds.includes(plan.id) ? "is-expanded" : ""}`}
              >
                <td className="data-table-primary px-4 py-3 font-medium" data-label="Nom">{plan.name}</td>
                <td className="px-4 py-3 text-muted-foreground mobile-detail-cell" data-label="Description">{plan.description ?? "—"}</td>
                <td className="px-4 py-3 text-right" data-label="Prix">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(plan.price / 100)}
                </td>
                <td className="px-4 py-3 text-center mobile-detail-cell" data-label="/ semaine">{plan.sessionsPerWeek ?? "—"}</td>
                <td className="px-4 py-3 text-center mobile-detail-cell" data-label="/ mois">{plan.totalSessions}</td>
                <td className="px-4 py-3 text-center mobile-detail-cell" data-label="Validité">{plan.validityDays}j</td>
                <td className="px-4 py-3 text-center mobile-detail-cell" data-label="Sport">{plan.sport?.name ?? "—"}</td>
                <td className="px-4 py-3 text-center" data-label="Statut">
                  <StatusBadge variant={plan.isActive ? "success" : "muted"}>{plan.isActive ? "Actif" : "Inactif"}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-center mobile-detail-cell" data-label="Souscriptions">{plan._count.subscriptions}</td>
                <td className="px-4 py-3 text-right card-actions-cell">
                  <div className="card-actions-stack">
                    <Link href={`/subscription-plans/${plan.id}/edit`} className="btn btn-ghost md:min-h-0 md:px-2 md:py-1 md:text-xs">
                      Modifier
                    </Link>
                    <button
                      type="button"
                      onClick={() => deletePlan(plan.id)}
                      disabled={loadingId === plan.id}
                      className="btn btn-danger md:min-h-0 md:px-2 md:py-1 md:text-xs"
                    >
                      {loadingId === plan.id ? "..." : "Supprimer"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mobile-card-toggle md:hidden"
                    onClick={() => toggleExpand(plan.id)}
                    aria-expanded={expandedPlanIds.includes(plan.id)}
                  >
                    Détails
                    <ChevronDown className={`size-3 transition-transform ${expandedPlanIds.includes(plan.id) ? "rotate-180" : ""}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
