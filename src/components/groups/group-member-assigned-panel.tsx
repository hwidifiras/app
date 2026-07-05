import { UserMinus, UsersRound } from "lucide-react";

import type { GroupMemberDto } from "@/types/group-member";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";

type GroupMemberAssignedPanelProps = {
  assignments: GroupMemberDto[];
  totalAssignments: number;
  selectedMemberIds: string[];
  search: string;
  loading: boolean;
  removing: boolean;
  actionLoadingId: string | null;
  groupSelected: boolean;
  onSearchChange: (value: string) => void;
  onToggleMember: (memberId: string) => void;
  onToggleAll: () => void;
  onClearSearch: () => void;
  onToggleStatus: (assignment: GroupMemberDto) => void;
  onQueueRemoval: (assignment: GroupMemberDto) => void;
  onQueueBulkRemoval: () => void;
};

export function GroupMemberAssignedPanel({
  assignments,
  totalAssignments,
  selectedMemberIds,
  search,
  loading,
  removing,
  actionLoadingId,
  groupSelected,
  onSearchChange,
  onToggleMember,
  onToggleAll,
  onClearSearch,
  onToggleStatus,
  onQueueRemoval,
  onQueueBulkRemoval,
}: GroupMemberAssignedPanelProps) {
  const allVisibleSelected =
    assignments.length > 0 && assignments.every((assignment) => selectedMemberIds.includes(assignment.memberId));

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Membres affectés</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{assignments.length} résultat(s)</p>
        </div>
        <button type="button" onClick={onToggleAll} className="btn btn-ghost text-xs">
          {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>

      <ListSearch value={search} onChange={onSearchChange} placeholder="Nom ou téléphone..." className="mt-3" />

      <ul className="mt-3 max-h-[min(45dvh,24rem)] space-y-2 overflow-auto pr-1">
        {loading ? (
          <li className="flex min-h-28 items-center justify-center text-sm text-[var(--muted-foreground)]">
            Chargement des affectations…
          </li>
        ) : null}
        {!loading
          ? assignments.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--border)] p-2">
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(item.memberId)}
                      onChange={() => onToggleMember(item.memberId)}
                    />
                    <span>
                      <span className="block font-medium text-[var(--foreground)]">{item.memberName}</span>
                      <span className="block text-[var(--muted-foreground)]">{item.memberPhone}</span>
                      <span className="block text-[var(--muted-foreground)]">
                        Du {new Date(item.startDate).toLocaleDateString("fr-FR")}
                        {item.endDate ? ` au ${new Date(item.endDate).toLocaleDateString("fr-FR")}` : ""}
                      </span>
                    </span>
                  </label>
                  <StatusBadge variant={item.status === "ACTIVE" ? "success" : "muted"}>
                    {item.status === "ACTIVE" ? "Actif" : "Inactif"}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleStatus(item)}
                    disabled={actionLoadingId === item.id}
                    className="btn btn-ghost text-xs"
                  >
                    {item.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onQueueRemoval(item)}
                    disabled={actionLoadingId === item.id}
                    className="btn btn-danger text-xs"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))
          : null}
        {!loading && assignments.length === 0 ? (
          <li>
            <EmptyState
              icon={<UsersRound className="size-7 opacity-45" />}
              title={totalAssignments === 0 ? "Groupe encore vide" : "Aucun résultat"}
              message={totalAssignments === 0 ? "Ajoutez des membres depuis la liste disponible." : "Aucune affectation ne correspond à cette recherche."}
              action={search ? <button type="button" onClick={onClearSearch} className="btn btn-ghost btn-sm">Effacer</button> : undefined}
              className="px-3 py-7"
            />
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={onQueueBulkRemoval}
        disabled={removing || !groupSelected || selectedMemberIds.length === 0}
        className="btn btn-danger mt-3 w-full"
      >
        <UserMinus className="size-4" />
        {removing ? "Retrait…" : `Retirer du groupe (${selectedMemberIds.length})`}
      </button>
    </section>
  );
}
