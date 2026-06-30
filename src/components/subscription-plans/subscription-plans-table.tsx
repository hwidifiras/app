"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, CreditCard, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, usePagination } from "@/components/ui/pagination";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<PlanRow | null>(null);

  const filteredPlans = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return plans.filter((plan) => {
      const matchesSearch =
        !query ||
        plan.name.toLocaleLowerCase("fr").includes(query) ||
        (plan.description?.toLocaleLowerCase("fr").includes(query) ?? false) ||
        (plan.sport?.name.toLocaleLowerCase("fr").includes(query) ?? false);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? plan.isActive : !plan.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [plans, searchTerm, statusFilter]);

  const activeFilterCount = statusFilter === "ALL" ? 0 : 1;
  const pagination = usePagination(filteredPlans, 20, `${searchTerm}|${statusFilter}`);

  function toggleExpand(planId: string) {
    setExpandedPlanIds((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
    );
  }

  async function deletePlan(planId: string) {
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
    setPendingDeletePlan(null);
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="list-toolbar sticky top-[57px] z-20 border-b border-[var(--border)] bg-[var(--surface)]/96 p-3 backdrop-blur lg:top-[3.5rem]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
            <ListSearch value={searchTerm} onChange={setSearchTerm} placeholder="Nom, discipline ou description..." />
          </div>
          <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
          <div className="hidden min-w-44 md:block">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut</label>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="field text-xs">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actifs</option>
                <option value="INACTIVE">Inactifs</option>
              </select>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={() => setStatusFilter("ALL")} className="btn btn-ghost px-3" title="Réinitialiser">
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {filteredPlans.length} plan{filteredPlans.length > 1 ? "s" : ""} affiché{filteredPlans.length > 1 ? "s" : ""}
        </p>
      </div>

      <FeedbackMessage message={message} className="mb-3" />
      {filteredPlans.length === 0 ? (
        <EmptyState
          className="m-3"
          icon={<CreditCard className="size-8 opacity-45" />}
          title={plans.length === 0 ? "Aucun plan" : "Aucun résultat"}
          message={plans.length === 0 ? "Créez la première formule proposée aux membres." : "Modifiez la recherche ou le statut."}
          action={
            plans.length === 0 ? (
              <Link href="/subscription-plans/new" className="btn btn-primary">Créer un plan</Link>
            ) : (
              <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }} className="btn btn-ghost">
                Réinitialiser
              </button>
            )
          }
        />
      ) : (
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
            {pagination.pageItems.map((plan) => (
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
                      onClick={() => setPendingDeletePlan(plan)}
                      disabled={loadingId === plan.id}
                      className="btn btn-ghost border-[var(--danger)]/30 text-[var(--danger)] md:min-h-0 md:px-2 md:py-1 md:text-xs"
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
      )}

      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalItems={filteredPlans.length}
        onPageChange={pagination.setPage}
        className="mx-3 mb-3"
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setStatusFilter("ALL")}
        activeCount={activeFilterCount}
        resultCount={filteredPlans.length}
        title="Filtrer les plans"
      >
        <FilterField label="Statut">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="field">
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
        </FilterField>
      </MobileFilterSheet>

      <ConfirmDialog
        open={pendingDeletePlan !== null}
        title="Supprimer ce plan ?"
        description={`Le plan « ${pendingDeletePlan?.name ?? ""} » sera supprimé. Vérifiez qu'il n'est plus nécessaire avant de continuer.`}
        confirmLabel="Supprimer le plan"
        loading={loadingId === pendingDeletePlan?.id}
        onCancel={() => setPendingDeletePlan(null)}
        onConfirm={() => pendingDeletePlan ? deletePlan(pendingDeletePlan.id) : undefined}
      />
    </div>
  );
}
