"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserMinus, UserPlus, UsersRound } from "lucide-react";

import { GroupMemberDto } from "@/types/group-member";
import { GroupDto } from "@/types/group";
import { MemberDto } from "@/types/member";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { FormField } from "@/components/ui/form-layout";

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
  const [bulkAction, setBulkAction] = useState<"assign" | "remove" | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<GroupMemberDto | "bulk" | null>(null);

  const selectedGroup = useMemo(() => groups.find((item) => item.id === groupId) ?? null, [groupId, groups]);
  const activeAssignments = useMemo(() => assignments.filter((item) => item.status === "ACTIVE"), [assignments]);

  const activeAssignedMemberIds = useMemo(
    () => new Set(activeAssignments.map((item) => item.memberId)),
    [activeAssignments],
  );

  const availableMembers = useMemo(() => {
    const groupType = selectedGroup?.groupType;
    const query = membersSearch.trim().toLowerCase();
    return members.filter((member) => {
      if (activeAssignedMemberIds.has(member.id)) {
        return false;
      }

      if (groupType === "KIDS") {
        if (member.memberType !== "KID" && member.memberType !== "NOT_SPECIFIED") {
          return false;
        }
      }

      if (groupType === "ADULTS") {
        if (member.memberType !== "ADULT" && member.memberType !== "NOT_SPECIFIED") {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
    });
  }, [activeAssignedMemberIds, members, membersSearch, selectedGroup?.groupType]);

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

    setAssignmentsLoading(true);
    try {
      const response = await fetch(`/api/group-members?groupId=${activeGroupId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Impossible de charger les affectations");
        return;
      }
      setAssignments(result.data ?? []);
    } finally {
      setAssignmentsLoading(false);
    }
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

    setBulkAction("assign");
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
      setBulkAction(null);
      return;
    }

    const summary = result.data ?? {};
    setMessage(
      `Affectation terminée: ${summary.createdCount ?? 0} créés, ${summary.reactivatedCount ?? 0} réactivés, ${summary.skippedCapacityCount ?? 0} refus capacité.`,
    );
    setSelectedMemberIds([]);
    setEndDate("");
    await reloadAssignments();
    setBulkAction(null);
  }

  async function removeSelectedAssignments() {
    if (!groupId || selectedAssignedMemberIds.length === 0) {
      return;
    }

    setBulkAction("remove");
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
      setMessage(result.error ?? "Erreur lors du retrait multiple");
      setBulkAction(null);
      return;
    }

    setMessage(`Retrait terminé: ${result.data?.closedCount ?? 0} affectation(s) fermée(s).`);
    setSelectedAssignedMemberIds([]);
    setPendingRemoval(null);
    await reloadAssignments();
    setBulkAction(null);
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
    setActionLoadingId(item.id);
    setMessage(null);

    const response = await fetch("/api/group-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupMemberId: item.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du retrait");
      setActionLoadingId(null);
      return;
    }

    setMessage("Affectation retirée du groupe");
    setPendingRemoval(null);
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
        <FormField label="Groupe">
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
        </FormField>
        <FormField label="Date de début">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" required />
        </FormField>
        <FormField label="Date de fin" hint="Optionnelle">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
        </FormField>
      </div>

      {selectedGroup ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
          <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Capacité</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{selectedGroup.capacity} membres</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">Actuellement</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{activeAssignments.length} actifs</p>
          </div>
        </div>
      ) : null}

      <FeedbackMessage message={message} className="mt-3" />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Membres disponibles</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{availableMembers.length} résultat(s)</p>
            </div>
            <button type="button" onClick={toggleSelectAllAvailable} className="btn btn-ghost text-xs">
              {availableMembers.length > 0 && availableMembers.every((m) => selectedMemberIds.includes(m.id))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <ListSearch
            value={membersSearch}
            onChange={setMembersSearch}
            placeholder="Nom ou téléphone..."
            className="mt-3"
          />

          <ul className="mt-3 max-h-[min(45dvh,24rem)] space-y-2 overflow-auto pr-1">
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
              <li>
                <EmptyState
                  icon={<UserPlus className="size-7 opacity-45" />}
                  title="Aucun membre disponible"
                  message={membersSearch ? "Aucun membre ne correspond à cette recherche." : "Tous les membres compatibles sont déjà affectés."}
                  action={membersSearch ? <button type="button" onClick={() => setMembersSearch("")} className="btn btn-ghost btn-sm">Effacer</button> : undefined}
                  className="px-3 py-7"
                />
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={() => {
              void assignSelectedMembers();
            }}
            disabled={bulkAction !== null || !groupId || selectedMemberIds.length === 0}
            className="btn btn-primary mt-3 w-full"
          >
            {bulkAction === "assign" ? "Affectation…" : `Ajouter au groupe (${selectedMemberIds.length})`}
          </button>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Membres affectés</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{displayedAssignments.length} résultat(s)</p>
            </div>
            <button type="button" onClick={toggleSelectAllAssigned} className="btn btn-ghost text-xs">
              {displayedAssignments.length > 0 &&
              displayedAssignments.every((a) => selectedAssignedMemberIds.includes(a.memberId))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>

          <ListSearch
            value={assignedSearch}
            onChange={setAssignedSearch}
            placeholder="Nom ou téléphone..."
            className="mt-3"
          />

          <ul className="mt-3 max-h-[min(45dvh,24rem)] space-y-2 overflow-auto pr-1">
            {assignmentsLoading ? (
              <li className="flex min-h-28 items-center justify-center text-sm text-[var(--muted-foreground)]">
                Chargement des affectations…
              </li>
            ) : null}
            {!assignmentsLoading ? displayedAssignments.map((item) => (
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
                    onClick={() => setPendingRemoval(item)}
                    disabled={actionLoadingId === item.id}
                    className="btn btn-danger text-xs"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            )) : null}
            {!assignmentsLoading && displayedAssignments.length === 0 ? (
              <li>
                <EmptyState
                  icon={<UsersRound className="size-7 opacity-45" />}
                  title={assignments.length === 0 ? "Groupe encore vide" : "Aucun résultat"}
                  message={assignments.length === 0 ? "Ajoutez des membres depuis la liste disponible." : "Aucune affectation ne correspond à cette recherche."}
                  action={assignedSearch ? <button type="button" onClick={() => setAssignedSearch("")} className="btn btn-ghost btn-sm">Effacer</button> : undefined}
                  className="px-3 py-7"
                />
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={() => setPendingRemoval("bulk")}
            disabled={bulkAction !== null || !groupId || selectedAssignedMemberIds.length === 0}
            className="btn btn-danger mt-3 w-full"
          >
            <UserMinus className="size-4" />
            {bulkAction === "remove" ? "Retrait…" : `Retirer du groupe (${selectedAssignedMemberIds.length})`}
          </button>
        </section>
      </div>

      <ConfirmDialog
        open={pendingRemoval === "bulk"}
        title={`Retirer ${selectedAssignedMemberIds.length} membre${selectedAssignedMemberIds.length > 1 ? "s" : ""} du groupe ?`}
        description={`Les affectations sélectionnées seront fermées pour le groupe « ${selectedGroup?.name ?? ""} ». Les dossiers membres et l'historique resteront conservés.`}
        confirmLabel="Retirer la sélection"
        loading={bulkAction === "remove"}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={removeSelectedAssignments}
      />
      <ConfirmDialog
        open={pendingRemoval !== null && pendingRemoval !== "bulk"}
        title="Retirer ce membre du groupe ?"
        description={`${pendingRemoval && pendingRemoval !== "bulk" ? pendingRemoval.memberName : ""} ne sera plus affecté au groupe « ${selectedGroup?.name ?? ""} ». Son dossier et l'historique resteront conservés.`}
        confirmLabel="Retirer du groupe"
        loading={pendingRemoval !== null && pendingRemoval !== "bulk" && actionLoadingId === pendingRemoval.id}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => pendingRemoval && pendingRemoval !== "bulk" ? removeAssignment(pendingRemoval) : undefined}
      />
    </section>
  );
}
