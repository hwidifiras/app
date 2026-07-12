"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CircleOff, CreditCard, Pencil, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  MobileRowToggle,
  TableActionsCell,
  Td,
  Th,
} from "@/components/ui/responsive-table";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatMoney } from "@/lib/money";

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
  planKind: "CLASS" | "GYM" | "MIXED";
  entitlements: Array<{
    type: "CLASS_SESSIONS" | "GYM_ACCESS";
    grantedUnits: number | null;
    sessionsPerWeek: number | null;
    gymAccessMode: "UNLIMITED" | "VISIT_QUOTA" | null;
    sport: { id: string; name: string } | null;
  }>;
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
      setMessage(result.error ?? "Erreur lors de la désactivation");
      setLoadingId(null);
      return;
    }

    setMessage("Formule désactivée avec succès");
    setPendingDeletePlan(null);
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="list-toolbar border-b border-[var(--border)] bg-[var(--surface)]/96 p-3">
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
          {filteredPlans.length} formule{filteredPlans.length > 1 ? "s" : ""} affichée{filteredPlans.length > 1 ? "s" : ""}
        </p>
      </div>

      <FeedbackMessage message={message} className="mb-3" />
      {filteredPlans.length === 0 ? (
        <EmptyState
          className="m-3"
          icon={<CreditCard className="size-8 opacity-45" />}
          title={plans.length === 0 ? "Aucune formule" : "Aucun résultat"}
          message={plans.length === 0 ? "Créez la première formule proposée aux membres." : "Modifiez la recherche ou le statut."}
          action={
            plans.length === 0 ? (
              <Link href="/subscription-plans/new" className="btn btn-primary">Créer une formule</Link>
            ) : (
              <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }} className="btn btn-ghost">
                Réinitialiser
              </button>
            )
          }
        />
      ) : (
      <DataTable className="rounded-none border-0 shadow-none">
        <DataTableHead>
          <tr>
            <Th className="min-w-[12rem]">Formule</Th>
            <Th className="min-w-[7rem] text-right">Prix</Th>
            <Th className="min-w-[8rem] text-center">Quota</Th>
            <Th className="hidden min-w-[7rem] text-center sm:table-cell">Validité</Th>
            <Th className="hidden min-w-[9rem] text-center md:table-cell">Discipline</Th>
            <Th className="min-w-[7rem] text-center">Statut</Th>
            <Th className="hidden min-w-[7rem] text-center lg:table-cell">Ventes</Th>
            <Th className="hidden text-right md:table-cell">Actions</Th>
            <Th className="px-2 text-center md:hidden"> </Th>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {pagination.pageItems.map((plan) => {
            const isExpanded = expandedPlanIds.includes(plan.id);
            const classRights = plan.entitlements.filter((item) => item.type === "CLASS_SESSIONS");
            const gymRight = plan.entitlements.find((item) => item.type === "GYM_ACCESS");
            const quotaLabel = plan.planKind === "GYM"
              ? gymRight?.gymAccessMode === "UNLIMITED" ? "Illimité" : `${gymRight?.grantedUnits ?? 0} visites`
              : plan.planKind === "MIXED" ? `${classRights.length} cours + salle` : `${classRights[0]?.sessionsPerWeek ?? plan.sessionsPerWeek ?? 0}/sem.`;
            const accessLabel = [
              ...classRights.map((item) => item.sport?.name).filter(Boolean),
              ...(gymRight ? ["Salle"] : []),
            ].join(" + ") || "—";
            return (
              <DataTableRow key={plan.id} expanded={isExpanded}>
                <Td primary className="min-w-[12rem] text-foreground">
                  <div className="font-semibold leading-snug">{plan.name}</div>
                  <p className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">
                    {plan.description?.trim() || accessLabel}
                  </p>
                </Td>
                <Td label="Prix" className="whitespace-nowrap text-right font-semibold">
                  {formatMoney(plan.price)}
                </Td>
                <Td label="Quota" mobileDetail className="text-center">
                  <span className="font-medium">{quotaLabel}</span>
                  <p className="text-xs text-muted-foreground">{plan.planKind === "CLASS" ? "Cours collectifs" : plan.planKind === "GYM" ? "Accès salle" : "Pack mixte"}</p>
                </Td>
                <Td label="Validité" mobileDetail className="hidden whitespace-nowrap text-center sm:table-cell">
                  {plan.validityDays} jours
                </Td>
                <Td label="Discipline" mobileDetail className="hidden text-center md:table-cell">
                  {accessLabel}
                </Td>
                <Td label="Statut" className="text-center">
                  <StatusBadge variant={plan.isActive ? "success" : "muted"}>
                    {plan.isActive ? "Actif" : "Inactif"}
                  </StatusBadge>
                </Td>
                <Td label="Ventes" mobileDetail className="hidden text-center lg:table-cell">
                  {plan._count.subscriptions}
                </Td>
                <TableActionsCell>
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    <Link
                      href={`/subscription-plans/${plan.id}/edit`}
                      prefetch={false}
                      className="btn btn-ghost btn-sm inline-flex size-9 items-center justify-center p-0"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDeletePlan(plan)}
                      disabled={loadingId === plan.id || !plan.isActive}
                      className="btn btn-ghost btn-sm inline-flex size-9 items-center justify-center border-[var(--warning)]/35 p-0 text-[var(--warning)] disabled:cursor-not-allowed disabled:opacity-45"
                      title={plan.isActive ? "Désactiver" : "Déjà inactive"}
                      aria-label="Désactiver"
                    >
                      <CircleOff className="size-4" />
                    </button>
                  </div>
                </TableActionsCell>
                <MobileRowToggle expanded={isExpanded} onToggle={() => toggleExpand(plan.id)} />
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
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
        title="Désactiver cette formule ?"
        description={`La formule « ${pendingDeletePlan?.name ?? ""} » sera retirée des nouvelles ventes sans effacer l'historique.`}
        confirmLabel="Désactiver la formule"
        loading={loadingId === pendingDeletePlan?.id}
        onCancel={() => setPendingDeletePlan(null)}
        onConfirm={() => pendingDeletePlan ? deletePlan(pendingDeletePlan.id) : undefined}
      />
    </div>
  );
}
