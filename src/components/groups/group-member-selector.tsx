"use client";

import { Check, UserRoundSearch, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { getMemberAvatarStyle, getMemberInitials } from "@/lib/member-avatar";
import { cn } from "@/lib/utils";
import type { MemberDto } from "@/types/member";

type GroupMemberSelectorProps = {
  members: MemberDto[];
  selectedIds: string[];
  search: string;
  title: string;
  description: string;
  emptyMessage: string;
  onSearchChange: (value: string) => void;
  onSelectionChange: (ids: string[]) => void;
};

function memberTypeLabel(memberType: MemberDto["memberType"]) {
  if (memberType === "KID") return "Enfant";
  if (memberType === "ADULT") return "Adulte";
  return "Non précisé";
}

export function GroupMemberSelector({
  members,
  selectedIds,
  search,
  title,
  description,
  emptyMessage,
  onSearchChange,
  onSelectionChange,
}: GroupMemberSelectorProps) {
  const visibleIds = members.map((member) => member.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleMember(memberId: string) {
    onSelectionChange(
      selectedIds.includes(memberId)
        ? selectedIds.filter((id) => id !== memberId)
        : [...selectedIds, memberId],
    );
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter((id) => !visibleIds.includes(id)));
      return;
    }
    onSelectionChange(Array.from(new Set([...selectedIds, ...visibleIds])));
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-center">
          <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Sélection</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{selectedIds.length} membre(s)</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <ListSearch
          value={search}
          onChange={onSearchChange}
          placeholder="Nom, téléphone ou email..."
        />
        <button
          type="button"
          className="btn btn-ghost btn-block-mobile shrink-0 text-xs sm:w-auto"
          onClick={toggleVisible}
          disabled={members.length === 0}
        >
          {allVisibleSelected ? "Tout désélectionner" : "Sélectionner les résultats"}
        </button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<UserRoundSearch className="size-8 opacity-45" />}
          title="Aucun membre"
          message={emptyMessage}
          action={
            search ? (
              <button type="button" className="btn btn-ghost" onClick={() => onSearchChange("")}>
                Effacer la recherche
              </button>
            ) : undefined
          }
          className="mt-3 py-8"
        />
      ) : (
        <div className="mt-3 grid max-h-[min(55dvh,34rem)] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {members.map((member) => {
            const selected = selectedIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMember(member.id)}
                aria-pressed={selected}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition",
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={getMemberAvatarStyle(member.id)}
                  aria-hidden="true"
                >
                  {getMemberInitials(member.firstName, member.lastName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    {member.phone}
                    {member.email ? ` · ${member.email}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                      {member.status === "ACTIVE" ? "Actif" : "Résilié"}
                    </StatusBadge>
                    <span className="text-[0.7rem] text-[var(--muted-foreground)]">
                      {memberTypeLabel(member.memberType)}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-[var(--border)] text-transparent",
                  )}
                  aria-hidden="true"
                >
                  <Check className="size-4" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <UsersRound className="size-4 shrink-0 text-[var(--primary)]" />
          {selectedIds.length} membre{selectedIds.length > 1 ? "s" : ""} sera{selectedIds.length > 1 ? "ont" : ""} affecté
          {selectedIds.length > 1 ? "s" : ""} à ce groupe.
        </div>
      ) : null}
    </section>
  );
}
