"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { GroupMemberSelector } from "@/components/groups/group-member-selector";
import { CoachDto } from "@/types/coach";
import { MemberDto } from "@/types/member";
import { SportDto } from "@/types/sport";

function formatCoachOptionLabel(coach: CoachDto) {
  const name = `${coach.firstName} ${coach.lastName}`;
  const qualified = coach.qualifiedSports.map((sport) => sport.name).join(", ");
  return qualified ? `${name} - ${qualified}` : coach.sportName ? `${name} - ${coach.sportName}` : name;
}

function coachIsQualifiedForSport(coach: CoachDto | undefined, sportId: string) {
  if (!coach || !sportId) return true;
  return coach.qualifiedSportIds.includes(sportId);
}

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
    groupType: "KIDS" | "ADULTS";
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
  const [groupType, setGroupType] = useState<"KIDS" | "ADULTS">(initialData.groupType);
  const [sportId, setSportId] = useState(initialData.sportId);
  const [coachId, setCoachId] = useState(initialData.coachId);
  const [coachSportOverrideReason, setCoachSportOverrideReason] = useState("");
  const [capacity, setCapacity] = useState(initialData.capacity);
  const [room, setRoom] = useState(initialData.room ?? "");
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [membersSearch, setMembersSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialMemberIds);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function isMemberAllowed(memberType: MemberDto["memberType"]) {
    if (groupType === "KIDS") {
      return memberType === "KID" || memberType === "NOT_SPECIFIED";
    }
    return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
  }

  const filteredMembers = membersOptions.filter((member) => {
    const query = membersSearch.trim().toLowerCase();
    if (!query) return true;
    return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
  }).filter((member) => isMemberAllowed(member.memberType));
  const selectedCoach = coachesOptions.find((coach) => coach.id === coachId);
  const coachSportPairChanged = sportId !== initialData.sportId || coachId !== initialData.coachId;
  const needsCoachSportOverride = coachSportPairChanged && !coachIsQualifiedForSport(selectedCoach, sportId);

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
          sportId,
          coachId,
          capacity,
          room,
          isActive,
          coachSportOverrideReason: needsCoachSportOverride ? coachSportOverrideReason : "",
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
      const addResponse = await fetch("/api/group-members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, memberIds: toAdd, startDate: new Date().toISOString(), endDate: null }),
      });
      const addResult = await addResponse.json();
      if (addResponse.ok) {
        addMsg = `${addResult.data?.createdCount ?? 0} ajouté(s)`;
      } else {
        addMsg = `Erreur ajout: ${addResult.error ?? ""}`;
      }
    }

    if (toRemove.length > 0) {
      const removeResponse = await fetch("/api/group-members/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, memberIds: toRemove }),
      });
      const removeResult = await removeResponse.json();
      if (removeResponse.ok) {
        removeMsg = `${removeResult.data?.deletedCount ?? 0} retiré(s)`;
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Compact group info form */}
      <div className="rounded-xl border border-[var(--border)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Informations groupe</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Sport</label>
            <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field text-sm" required>
              <option value="">Choisir</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Type de groupe</label>
            <select
              value={groupType}
              onChange={(e) => {
                const nextType = e.target.value as "KIDS" | "ADULTS";
                setGroupType(nextType);
                const allowedIds = new Set(
                  membersOptions
                    .filter((member) => {
                      if (nextType === "KIDS") {
                        return member.memberType === "KID" || member.memberType === "NOT_SPECIFIED";
                      }
                      return member.memberType === "ADULT" || member.memberType === "NOT_SPECIFIED";
                    })
                    .map((member) => member.id)
                );
                setSelectedMemberIds((current) => current.filter((id) => allowedIds.has(id)));
              }}
              className="field text-sm"
              required
            >
              <option value="ADULTS">Adultes</option>
              <option value="KIDS">Enfants</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Coach</label>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="field text-sm" required>
              <option value="">Choisir</option>
              {coachesOptions.map((coach) => (
                <option key={coach.id} value={coach.id}>{formatCoachOptionLabel(coach)}</option>
              ))}
            </select>
            {needsCoachSportOverride ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                Coach hors qualification pour ce sport. Validation admin avec motif obligatoire.
              </p>
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
          <div className="sm:col-span-2 lg:col-span-1 flex items-center gap-2 pt-5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm text-[var(--muted-foreground)]">Groupe actif</span>
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
      </div>

      <GroupMemberSelector
        members={filteredMembers}
        selectedIds={selectedMemberIds}
        search={membersSearch}
        title="Membres du groupe"
        description="Sélectionnez les membres à conserver ou à ajouter. Désélectionner retire l'affectation."
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
