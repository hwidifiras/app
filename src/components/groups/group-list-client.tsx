"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleOff, Clock, Pencil, RotateCcw, UsersRound } from "lucide-react";
import { formatGroupRoomLabel } from "@/lib/group-room";
import { GroupDto } from "@/types/group";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
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
import { Pagination, usePagination } from "@/components/ui/pagination";

export function GroupListClient({ initialGroups }: { initialGroups: GroupDto[] }) {
  const [groups, setGroups] = useState<GroupDto[]>(initialGroups);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeactivateGroup, setPendingDeactivateGroup] = useState<GroupDto | null>(null);

  function toggleExpand(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

  const filteredGroups = useMemo(() => groups.filter((group) => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    const matchesSearch =
      !query ||
      group.name.toLocaleLowerCase("fr").includes(query) ||
      group.sportName.toLocaleLowerCase("fr").includes(query) ||
      group.coachName.toLocaleLowerCase("fr").includes(query) ||
      (group.room ?? "").toLocaleLowerCase("fr").includes(query);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" ? group.isActive : !group.isActive);
    return matchesSearch && matchesStatus;
  }), [groups, searchTerm, statusFilter]);

  const activeFilterCount = statusFilter === "ALL" ? 0 : 1;
  const pagination = usePagination(filteredGroups, 20, `${searchTerm}|${statusFilter}`);

  async function deactivateGroup(groupId: string) {
    setActionLoadingId(groupId);
    setMessage(null);

    const response = await fetch("/api/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la désactivation");
      setActionLoadingId(null);
      return;
    }

    const deactivatedGroup = (result.data as GroupDto | undefined) ?? null;
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId ? (deactivatedGroup ?? { ...group, isActive: false }) : group,
      ),
    );
    setPendingDeactivateGroup(null);
    setMessage("Cours désactivé. Les séances et l'historique restent consultables.");
    setActionLoadingId(null);
  }

  function dayLabel(value: string) {
    const map: Record<string, string> = {
      MONDAY: "Lundi",
      TUESDAY: "Mardi",
      WEDNESDAY: "Mercredi",
      THURSDAY: "Jeudi",
      FRIDAY: "Vendredi",
      SATURDAY: "Samedi",
      SUNDAY: "Dimanche",
    };
    return map[value] ?? value;
  }

  function formatSchedules(schedules: GroupDto["schedules"]) {
    if (schedules.length === 0) return "—";
    return schedules.map((s) => `${dayLabel(s.dayOfWeek)} ${s.startTime} (${s.durationMinutes} min)`).join(", ");
  }

  return (
    <div>
      <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mb-4 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Recherche</label>
          <ListSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Nom, sport, coach, salle..."
          />
        </div>
        <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
        <div className="hidden min-w-44 md:block">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Statut</label>
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
        <div>
          <Link href="/groups/new" className="btn btn-primary btn-block-mobile">
            + Nouveau cours
          </Link>
        </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {filteredGroups.length} groupe{filteredGroups.length > 1 ? "s" : ""} affiché{filteredGroups.length > 1 ? "s" : ""}
        </p>
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-8 opacity-45" />}
          title={groups.length === 0 ? "Aucun groupe" : "Aucun résultat"}
          message={groups.length === 0 ? "Créez le premier cours et ses créneaux." : "Modifiez la recherche ou le filtre de statut."}
          action={
            groups.length === 0 ? (
              <Link href="/groups/new" className="btn btn-primary">Créer un cours</Link>
            ) : (
              <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }} className="btn btn-ghost">
                Réinitialiser
              </button>
            )
          }
        />
      ) : (
      <DataTable>
        <DataTableHead>
          <tr>
            <Th>Nom</Th>
            <Th>Sport</Th>
            <Th className="hidden sm:table-cell">Coach</Th>
            <Th className="hidden md:table-cell">Créneau</Th>
            <Th>Statut</Th>
            <Th className="hidden text-right sm:table-cell">Actions</Th>
            <Th className="px-2 text-center md:hidden"> </Th>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {pagination.pageItems.map((group) => {
            const isExpanded = expandedGroupIds.includes(group.id);
            return (
              <DataTableRow key={group.id} expanded={isExpanded}>
                <Td label="Nom" primary className="font-medium text-foreground">
                  {group.name}
                  <p className="text-xs text-muted-foreground">
                    Salle {formatGroupRoomLabel(group.room)} • Cap. {group.capacity}
                  </p>
                </Td>
                <Td label="Sport" mobileDetail>
                  {group.sportName}
                </Td>
                <Td label="Coach" mobileDetail className="hidden sm:table-cell">
                  {group.coachName}
                </Td>
                <Td label="Créneau" mobileDetail className="hidden text-muted-foreground md:table-cell">
                  {formatSchedules(group.schedules)}
                </Td>
                <Td label="Statut" mobileDetail>
                  <StatusBadge variant={group.isActive ? "success" : "muted"}>
                    {group.isActive ? "Actif" : "Inactif"}
                  </StatusBadge>
                </Td>
                <TableActionsCell>
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    <Link
                      href={`/groups/${group.id}/schedules`}
                      className="btn btn-ghost btn-sm inline-flex size-9 items-center justify-center p-0"
                      title="Planifier"
                      aria-label="Planifier"
                    >
                      <Clock className="size-4" />
                    </Link>
                    <Link
                      href={`/groups/${group.id}/edit`}
                      className="btn btn-ghost btn-sm inline-flex size-9 items-center justify-center p-0"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDeactivateGroup(group)}
                      disabled={actionLoadingId === group.id}
                      className="btn btn-ghost btn-sm inline-flex size-9 items-center justify-center border-[var(--warning)]/35 p-0 text-[var(--warning)]"
                      title="Désactiver"
                      aria-label="Désactiver"
                    >
                      <CircleOff className="size-4" />
                    </button>
                  </div>
                </TableActionsCell>
                <MobileRowToggle expanded={isExpanded} onToggle={() => toggleExpand(group.id)} />
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
      )}

      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalItems={filteredGroups.length}
        onPageChange={pagination.setPage}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => setStatusFilter("ALL")}
        activeCount={activeFilterCount}
        resultCount={filteredGroups.length}
        title="Filtrer les groupes"
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
        open={pendingDeactivateGroup !== null}
        title="Désactiver ce cours ?"
        description={`Le cours « ${pendingDeactivateGroup?.name ?? ""} » ne sera plus proposé aux nouvelles inscriptions. Les séances et l'historique restent consultables.`}
        confirmLabel="Désactiver le cours"
        loading={actionLoadingId === pendingDeactivateGroup?.id}
        onCancel={() => setPendingDeactivateGroup(null)}
        onConfirm={() => pendingDeactivateGroup ? deactivateGroup(pendingDeactivateGroup.id) : undefined}
      />
    </div>
  );
}
