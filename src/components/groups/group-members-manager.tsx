"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GroupMemberDto } from "@/types/group-member";
import { GroupDto } from "@/types/group";
import { MemberDto } from "@/types/member";
import { GroupMemberAssignedPanel } from "@/components/groups/group-member-assigned-panel";
import { GroupMemberAvailablePanel } from "@/components/groups/group-member-available-panel";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-layout";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { isMemberAllowedInGroupPolicy } from "@/lib/demographics";

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
  const assignmentIntent = useIdempotencyIntent();

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

      if (selectedGroup) {
        const allowed = isMemberAllowedInGroupPolicy({
          groupType: selectedGroup.groupType,
          genderPolicy: selectedGroup.genderPolicy,
          memberType: member.memberType,
          gender: member.gender,
        });
        if (!allowed) return false;
      }

      if (!query) {
        return true;
      }

      return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
    });
  }, [activeAssignedMemberIds, members, membersSearch, selectedGroup]);

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
    const requestPayload = {
      groupId,
      memberIds: selectedMemberIds,
      startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
      endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
    };

    const response = await fetch("/api/group-members/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
      },
      body: JSON.stringify(requestPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'affectation multiple");
      setBulkAction(null);
      return;
    }
    assignmentIntent.complete(requestPayload);

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
    const requestPayload = { groupId, memberIds: selectedAssignedMemberIds };

    const response = await fetch("/api/group-members/bulk", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
      },
      body: JSON.stringify(requestPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du retrait multiple");
      setBulkAction(null);
      return;
    }
    assignmentIntent.complete(requestPayload);

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
    const requestPayload = {
      groupMemberId: item.id,
      payload: { status: nextStatus },
    };

    const response = await fetch("/api/group-members", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
      },
      body: JSON.stringify(requestPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la mise à jour du statut");
      setActionLoadingId(null);
      return;
    }
    assignmentIntent.complete(requestPayload);

    setMessage("Statut mis à jour");
    await reloadAssignments();
    setActionLoadingId(null);
  }

  async function removeAssignment(item: GroupMemberDto) {
    setActionLoadingId(item.id);
    setMessage(null);
    const requestPayload = { groupMemberId: item.id };

    const response = await fetch("/api/group-members", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
      },
      body: JSON.stringify(requestPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du retrait");
      setActionLoadingId(null);
      return;
    }
    assignmentIntent.complete(requestPayload);

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
        <GroupMemberAvailablePanel
          members={availableMembers}
          selectedMemberIds={selectedMemberIds}
          search={membersSearch}
          assigning={bulkAction === "assign"}
          groupSelected={Boolean(groupId)}
          onSearchChange={setMembersSearch}
          onToggleMember={toggleMemberSelection}
          onToggleAll={toggleSelectAllAvailable}
          onClearSearch={() => setMembersSearch("")}
          onAssign={() => {
            void assignSelectedMembers();
          }}
        />

        <GroupMemberAssignedPanel
          assignments={displayedAssignments}
          totalAssignments={assignments.length}
          selectedMemberIds={selectedAssignedMemberIds}
          search={assignedSearch}
          loading={assignmentsLoading}
          removing={bulkAction === "remove"}
          actionLoadingId={actionLoadingId}
          groupSelected={Boolean(groupId)}
          onSearchChange={setAssignedSearch}
          onToggleMember={toggleAssignedSelection}
          onToggleAll={toggleSelectAllAssigned}
          onClearSearch={() => setAssignedSearch("")}
          onToggleStatus={(item) => {
            void toggleStatus(item);
          }}
          onQueueRemoval={setPendingRemoval}
          onQueueBulkRemoval={() => setPendingRemoval("bulk")}
        />
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
