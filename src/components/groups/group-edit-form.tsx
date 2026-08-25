"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import { GroupCoachEligibility } from "@/components/groups/group-coach-eligibility";
import { GroupMemberSelector } from "@/components/groups/group-member-selector";
import { GroupPolicyPicker } from "@/components/groups/group-policy-picker";
import { GroupSetupSummary } from "@/components/groups/group-setup-summary";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { formatCoachName, formatCoachOptionLabel, isCoachQualifiedForSport } from "@/lib/coach-display";
import { isMemberAllowedInGroupPolicy, type GroupGenderPolicyValue, type GroupTypeValue } from "@/lib/demographics";
import { CoachDto } from "@/types/coach";
import { MemberDto } from "@/types/member";
import { SportDto } from "@/types/sport";

export function GroupEditForm({
  groupId,
  initialData,
  sportsOptions,
  coachesOptions,
  membersOptions,
  initialMemberIds,
}: {
  groupId: string;
  initialData: {
    name: string;
    groupType: GroupTypeValue;
    genderPolicy: GroupGenderPolicyValue;
    sportId: string;
    coachId: string;
    capacity: number;
    room: string | null;
    isActive: boolean;
  };
  sportsOptions: SportDto[];
  coachesOptions: CoachDto[];
  membersOptions: MemberDto[];
  initialMemberIds: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialData.name);
  const [groupType, setGroupType] = useState<GroupTypeValue>(initialData.groupType);
  const [genderPolicy, setGenderPolicy] = useState<GroupGenderPolicyValue>(initialData.genderPolicy);
  const [sportId, setSportId] = useState(initialData.sportId);
  const [coachId, setCoachId] = useState(initialData.coachId);
  const [applyCoachToFutureSessions, setApplyCoachToFutureSessions] = useState(false);
  const [coachSportOverrideReason, setCoachSportOverrideReason] = useState("");
  const [capacity, setCapacity] = useState(initialData.capacity);
  const [room, setRoom] = useState(initialData.room ?? "");
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [membersSearch, setMembersSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialMemberIds);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assignmentIntent = useIdempotencyIntent();

  function isMemberAllowed(member: MemberDto, nextGroupType = groupType, nextGenderPolicy = genderPolicy) {
    return isMemberAllowedInGroupPolicy({
      groupType: nextGroupType,
      genderPolicy: nextGenderPolicy,
      memberType: member.memberType,
      gender: member.gender,
    });
  }

  const filteredMembers = membersOptions.filter((member) => {
    const query = membersSearch.trim().toLowerCase();
    if (!query) return true;
    return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
  }).filter((member) => isMemberAllowed(member));
  const selectedCoach = coachesOptions.find((coach) => coach.id === coachId);
  const selectedSport = sportsOptions.find((sport) => sport.id === sportId);
  const compatibleMemberCount = membersOptions.filter((member) => isMemberAllowed(member)).length;
  const coachChanged = coachId !== initialData.coachId;
  const coachSportPairChanged = sportId !== initialData.sportId || coachId !== initialData.coachId;
  const needsCoachSportOverride = coachSportPairChanged && !isCoachQualifiedForSport(selectedCoach, sportId);

  function applyGroupType(nextType: GroupTypeValue) {
    setGroupType(nextType);
    const allowedIds = new Set(
      membersOptions
        .filter((member) => isMemberAllowed(member, nextType, genderPolicy))
        .map((member) => member.id),
    );
    setSelectedMemberIds((current) => current.filter((id) => allowedIds.has(id)));
  }

  function applyGenderPolicy(nextPolicy: GroupGenderPolicyValue) {
    setGenderPolicy(nextPolicy);
    const allowedIds = new Set(
      membersOptions
        .filter((member) => isMemberAllowed(member, groupType, nextPolicy))
        .map((member) => member.id),
    );
    setSelectedMemberIds((current) => current.filter((id) => allowedIds.has(id)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const patchResponse = await fetch("/api/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        payload: {
          name,
          groupType,
          genderPolicy,
          sportId,
          coachId,
          capacity,
          room,
          isActive,
          coachSportOverrideReason: needsCoachSportOverride ? coachSportOverrideReason : "",
          applyCoachToFutureSessions: coachChanged ? applyCoachToFutureSessions : false,
        },
      }),
    });

    const patchResult = await patchResponse.json();

    if (!patchResponse.ok) {
      setMessage(patchResult.error ?? "Erreur lors de la modification du groupe");
      setLoading(false);
      return;
    }

    const toAdd = selectedMemberIds.filter((id) => !initialMemberIds.includes(id));
    const toRemove = initialMemberIds.filter((id) => !selectedMemberIds.includes(id));

    let addMsg = "";
    let removeMsg = "";

    if (toAdd.length > 0) {
      const requestPayload = {
        groupId,
        memberIds: toAdd,
        startDate: `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
        endDate: null,
      };
      const addResponse = await fetch("/api/group-members/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
      const addResult = await addResponse.json();
      if (addResponse.ok) {
        assignmentIntent.complete(requestPayload);
        addMsg = `${addResult.data?.createdCount ?? 0} ajouté(s)`;
      } else {
        addMsg = `Erreur ajout: ${addResult.error ?? ""}`;
      }
    }

    if (toRemove.length > 0) {
      const requestPayload = { groupId, memberIds: toRemove };
      const removeResponse = await fetch("/api/group-members/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": assignmentIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
      const removeResult = await removeResponse.json();
      if (removeResponse.ok) {
        assignmentIntent.complete(requestPayload);
        removeMsg = `${removeResult.data?.closedCount ?? 0} retiré(s)`;
      } else {
        removeMsg = `Erreur retrait: ${removeResult.error ?? ""}`;
      }
    }

    const parts = ["Groupe modifié avec succès"];
    if (addMsg) parts.push(addMsg);
    if (removeMsg) parts.push(removeMsg);
    setMessage(parts.join(" • "));
    router.push("/groups");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4 lg:pb-0">
      <FormSectionNav
        items={[
          { href: "#group-info", label: "Cours" },
          { href: "#group-members", label: "Élèves" },
        ]}
      />

      <GroupSetupSummary
        name={name}
        sportName={selectedSport?.name}
        coachName={formatCoachName(selectedCoach)}
        room={room}
        capacity={capacity}
        groupType={groupType}
        genderPolicy={genderPolicy}
        compatibleMemberCount={compatibleMemberCount}
        selectedMemberCount={selectedMemberIds.length}
        totalMemberCount={membersOptions.length}
        isActive={isActive}
        coachOverrideActive={needsCoachSportOverride}
      />

      <FormSection
        id="group-info"
        title="Modifier le cours"
        description="Les changements de public filtrent les élèves sélectionnables. Les séances futures gardent leur logique de sécurité."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Discipline</label>
            <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field text-sm" required>
              <option value="">Choisir</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <GroupPolicyPicker
              groupType={groupType}
              genderPolicy={genderPolicy}
              onGroupTypeChange={applyGroupType}
              onGenderPolicyChange={applyGenderPolicy}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Coach du cours</label>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="field text-sm" required>
              <option value="">Choisir</option>
              {coachesOptions.map((coach) => (
                <option key={coach.id} value={coach.id}>{formatCoachOptionLabel(coach)}</option>
              ))}
            </select>
            <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
              Utilisé pour les nouvelles séances générées. Les séances déjà créées gardent leur coach sauf option ci-dessous.
            </p>
            <GroupCoachEligibility
              coaches={coachesOptions}
              selectedCoach={selectedCoach}
              selectedSportId={sportId}
              selectedSportName={selectedSport?.name}
              onSelectCoach={setCoachId}
            />
            {needsCoachSportOverride ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                Coach hors qualification pour cette discipline. Validation admin avec motif obligatoire.
              </p>
            ) : null}
            {coachChanged ? (
              <label className="mt-3 flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
                <input
                  type="checkbox"
                  checked={applyCoachToFutureSessions}
                  onChange={(e) => setApplyCoachToFutureSessions(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-[var(--foreground)]">
                    Appliquer aussi aux séances futures sans pointage
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    Ne touche pas l&apos;historique, les séances terminées, annulées ou déjà pointées.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Salle par défaut</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Optionnel — définir par séance"
              className="field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Capacité</label>
            <input type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="field text-sm" required />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 flex items-start gap-2 pt-5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm text-[var(--muted-foreground)]">
              <span className="block font-medium text-[var(--foreground)]">Groupe actif</span>
              <span className="block text-xs">Désactiver masque le groupe sans supprimer l&apos;historique.</span>
            </span>
          </div>
        </div>
        {needsCoachSportOverride ? (
          <div className="mt-3">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Motif admin d&apos;exception
            </label>
            <textarea
              value={coachSportOverrideReason}
              onChange={(e) => setCoachSportOverrideReason(e.target.value)}
              maxLength={500}
              className="field min-h-20 text-sm"
              required
            />
          </div>
        ) : null}
      </FormSection>

      <GroupMemberSelector
        id="group-members"
        members={filteredMembers}
        selectedIds={selectedMemberIds}
        search={membersSearch}
        title="Membres du groupe"
        description="Sélectionnez les élèves à conserver ou à ajouter. Désélectionner ferme l'affectation sans supprimer l'historique."
        emptyMessage="Aucun membre compatible avec ce type de groupe."
        onSearchChange={setMembersSearch}
        onSelectionChange={setSelectedMemberIds}
      />

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/groups")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="submit" disabled={loading || (needsCoachSportOverride && !coachSportOverrideReason.trim())} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </FormActions>
    </form>
  );
}
