"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GroupMemberDto } from "@/types/group-member";
import { GroupDto } from "@/types/group";
import { MemberDto } from "@/types/member";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type GroupMembersManagerProps = {
  groups: GroupDto[];
  members: MemberDto[];
};

export function GroupMembersManager({ groups, members }: GroupMembersManagerProps) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedAssignedMemberIds, setSelectedAssignedMemberIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<GroupMemberDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(() => groups.find((item) => item.id === groupId) ?? null, [groupId, groups]);
  const activeAssignments = useMemo(() => assignments.filter((item) => item.status === "ACTIVE"), [assignments]);

  const activeAssignedMemberIds = useMemo(
    () => new Set(activeAssignments.map((item) => item.memberId)),
    [activeAssignments],
  );

  const availableMembers = useMemo(() => {
    const query = membersSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (activeAssignedMemberIds.has(member.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
    });
  }, [activeAssignedMemberIds, members, membersSearch]);

  const displayedAssignments = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase();
    return assignments.filter((item) => {
      if (!query) {
        return true;
      }
      return item.memberName.toLowerCase().includes(query) || item.memberPhone.toLowerCase().includes(query);
    });
  }, [assignments, assignedSearch]);

  const reloadAssignments = useCallback(async (targetGroupId?: string) => {
    const activeGroupId = targetGroupId ?? groupId;
    if (!activeGroupId) {
      setAssignments([]);
      return;
    }

    const response = await fetch(`/api/group-members?groupId=${activeGroupId}`, { cache: "no-store" });
    const result = await response.json();
    setAssignments(result.data ?? []);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void reloadAssignments(groupId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [groupId, reloadAssignments]);

  async function onGroupChange(nextGroupId: string) {
    setGroupId(nextGroupId);
    setSelectedMemberIds([]);
    setSelectedAssignedMemberIds([]);
    setMembersSearch("");
    setAssignedSearch("");
    await reloadAssignments(nextGroupId);
  }

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((item) => item !== memberId) : [...current, memberId],
    );
  }

  function toggleAssignedSelection(memberId: string) {
    setSelectedAssignedMemberIds((current) =>
      current.includes(memberId) ? current.filter((item) => item !== memberId) : [...current, memberId],
    );
  }

  function toggleSelectAllAvailable() {
    const visibleIds = availableMembers.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedMemberIds.includes(id));

    if (allVisibleSelected) {
      setSelectedMemberIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedMemberIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function toggleSelectAllAssigned() {
    const visibleIds = displayedAssignments.map((item) => item.memberId);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAssignedMemberIds.includes(id));

    if (allVisibleSelected) {
      setSelectedAssignedMemberIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedAssignedMemberIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  async function assignSelectedMembers() {
    if (!groupId || selectedMemberIds.length === 0) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/group-members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        memberIds: selectedMemberIds,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'affectation multiple");
      setLoading(false);
      return;
    }

    const summary = result.data ?? {};
    setMessage(
      `Affectation terminée: ${summary.createdCount ?? 0} créés, ${summary.reactivatedCount ?? 0} réactivés, ${summary.skippedCapacityCount ?? 0} refus capacité.`,
    );
    setSelectedMemberIds([]);
    setEndDate("");
    await reloadAssignments();
    setLoading(false);
  }

  async function removeSelectedAssignments() {
    if (!groupId || selectedAssignedMemberIds.length === 0) {
      return;
    }

    const confirmed = window.confirm("Confirmer la suppression des affectations sélectionnées ?");
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/group-members/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        memberIds: selectedAssignedMemberIds,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression multiple");
      setLoading(false);
      return;
    }

    setMessage(`Suppression terminée: ${result.data?.deletedCount ?? 0} affectations supprimées.`);
    setSelectedAssignedMemberIds([]);
    await reloadAssignments();
    setLoading(false);
  }

  async function toggleStatus(item: GroupMemberDto) {
    setActionLoadingId(item.id);
    setMessage(null);

    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const response = await fetch("/api/group-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupMemberId: item.id,
        payload: {
          status: nextStatus,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la mise à jour du statut");
      setActionLoadingId(null);
      return;
    }

    setMessage("Statut mis à jour");
    await reloadAssignments();
    setActionLoadingId(null);
  }

  async function removeAssignment(item: GroupMemberDto) {
    const confirmed = window.confirm("Confirmer la suppression de cette affectation ?");
    if (!confirmed) {
      return;
    }

    setActionLoadingId(item.id);
    setMessage(null);

    const response = await fetch("/api/group-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupMemberId: item.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression");
      setActionLoadingId(null);
      return;
    }

    setMessage("Affectation supprimée");
    await reloadAssignments();
    setActionLoadingId(null);
  }

  return (
    <section className="panel p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Affectation membres ↔ groupes</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Affectation datée des membres à un groupe avec contrôle automatique de capacité.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          value={groupId}
          onChange={(e) => {
            void onGroupChange(e.target.value);
          }}
          className="field"
          required
        >
          <option value="">Choisir un groupe</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" required />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
      </div>

      {selectedGroup ? (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Capacité groupe: {selectedGroup.capacity} • Affectations actives: {activeAssignments.length}
        </p>
      ) : null}

      <FeedbackMessage message={message} className="mt-3" />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Ajouter des membres</h3>
            <button type="button" onClick={toggleSelectAllAvailable} className="btn btn-ghost text-xs">
              {availableMembers.length > 0 && availableMembers.every((m) => selectedMemberIds.includes(m.id))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <input
            value={membersSearch}
            onChange={(e) => setMembersSearch(e.target.value)}
            placeholder="Rechercher membre à ajouter"
            className="field mt-3 text-xs"
          />

          <ul className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
            {availableMembers.map((member) => (
              <li key={member.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(member.id)}
                  onChange={() => toggleMemberSelection(member.id)}
                />
                <span className="font-medium text-[var(--foreground)]">
                  {member.firstName} {member.lastName}
                </span>
                <span className="text-[var(--muted-foreground)]">• {member.phone}</span>
              </li>
            ))}
            {availableMembers.length === 0 ? (
              <li className="rounded-lg border border-dashed border-[var(--border)] p-2 text-xs text-[var(--muted-foreground)]">
                Aucun membre disponible pour ajout.
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={() => {
              void assignSelectedMembers();
            }}
            disabled={loading || !groupId || selectedMemberIds.length === 0}
            className="btn btn-primary mt-3 w-full"
          >
            {loading ? "Affectation..." : `Ajouter la sélection (${selectedMemberIds.length})`}
          </button>
        </section>

        <section className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Membres affectés</h3>
            <button type="button" onClick={toggleSelectAllAssigned} className="btn btn-ghost text-xs">
              {displayedAssignments.length > 0 &&
              displayedAssignments.every((a) => selectedAssignedMemberIds.includes(a.memberId))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <input
            value={assignedSearch}
            onChange={(e) => setAssignedSearch(e.target.value)}
            placeholder="Rechercher membre affecté"
            className="field mt-3 text-xs"
          />

          <ul className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
            {displayedAssignments.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--border)] p-2">
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedAssignedMemberIds.includes(item.memberId)}
                      onChange={() => toggleAssignedSelection(item.memberId)}
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
                    onClick={() => {
                      void toggleStatus(item);
                    }}
                    disabled={actionLoadingId === item.id}
                    className="btn btn-ghost text-xs"
                  >
                    {item.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void removeAssignment(item);
                    }}
                    disabled={actionLoadingId === item.id}
                    className="btn btn-danger text-xs"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
            {displayedAssignments.length === 0 ? (
              <li className="rounded-lg border border-dashed border-[var(--border)] p-2 text-xs text-[var(--muted-foreground)]">
                Aucune affectation pour ce groupe.
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={() => {
              void removeSelectedAssignments();
            }}
            disabled={loading || !groupId || selectedAssignedMemberIds.length === 0}
            className="btn btn-danger mt-3 w-full"
          >
            {loading ? "Suppression..." : `Supprimer la sélection (${selectedAssignedMemberIds.length})`}
          </button>
        </section>
      </div>
    </section>
  );
}
