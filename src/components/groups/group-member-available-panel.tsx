import { UserPlus } from "lucide-react";

import type { MemberDto } from "@/types/member";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";

type GroupMemberAvailablePanelProps = {
  members: MemberDto[];
  selectedMemberIds: string[];
  search: string;
  assigning: boolean;
  groupSelected: boolean;
  onSearchChange: (value: string) => void;
  onToggleMember: (memberId: string) => void;
  onToggleAll: () => void;
  onClearSearch: () => void;
  onAssign: () => void;
};

export function GroupMemberAvailablePanel({
  members,
  selectedMemberIds,
  search,
  assigning,
  groupSelected,
  onSearchChange,
  onToggleMember,
  onToggleAll,
  onClearSearch,
  onAssign,
}: GroupMemberAvailablePanelProps) {
  const allVisibleSelected = members.length > 0 && members.every((member) => selectedMemberIds.includes(member.id));

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Membres disponibles</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{members.length} résultat(s)</p>
        </div>
        <button type="button" onClick={onToggleAll} className="btn btn-ghost text-xs">
          {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>

      <ListSearch value={search} onChange={onSearchChange} placeholder="Nom ou téléphone..." className="mt-3" />

      <ul className="mt-3 max-h-[min(45dvh,24rem)] space-y-2 overflow-auto pr-1">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={selectedMemberIds.includes(member.id)}
              onChange={() => onToggleMember(member.id)}
            />
            <span className="font-medium text-[var(--foreground)]">
              {member.firstName} {member.lastName}
            </span>
            <span className="text-[var(--muted-foreground)]">• {member.phone}</span>
          </li>
        ))}
        {members.length === 0 ? (
          <li>
            <EmptyState
              icon={<UserPlus className="size-7 opacity-45" />}
              title="Aucun membre disponible"
              message={search ? "Aucun membre ne correspond à cette recherche." : "Tous les membres compatibles sont déjà affectés."}
              action={search ? <button type="button" onClick={onClearSearch} className="btn btn-ghost btn-sm">Effacer</button> : undefined}
              className="px-3 py-7"
            />
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={onAssign}
        disabled={assigning || !groupSelected || selectedMemberIds.length === 0}
        className="btn btn-primary mt-3 w-full"
      >
        {assigning ? "Affectation…" : `Ajouter au groupe (${selectedMemberIds.length})`}
      </button>
    </section>
  );
}
