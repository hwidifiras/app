"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { CoachDto } from "@/types/coach";
import { MemberDto } from "@/types/member";
import { SportDto } from "@/types/sport";

function formatCoachOptionLabel(coach: CoachDto) {
  const name = `${coach.firstName} ${coach.lastName}`;
  return coach.sportName ? `${name} - ${coach.sportName}` : name;
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

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  function toggleSelectAll() {
    const visibleIds = filteredMembers.map((m) => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedMemberIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
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
          sportId,
          coachId,
          capacity,
          room,
          isActive,
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
    setLoading(false);

    setTimeout(() => {
      router.push("/groups");
    }, 1000);
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
      </div>

      {/* Member table matching /members style */}
      <div className="rounded-xl border border-[var(--border)] p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Membres du groupe ({selectedMemberIds.length})
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              value={membersSearch}
              onChange={(e) => setMembersSearch(e.target.value)}
              placeholder="Rechercher..."
              className="field w-full text-xs sm:w-48"
            />
            <button type="button" className="btn btn-ghost btn-block-mobile text-xs" onClick={toggleSelectAll}>
              {filteredMembers.length > 0 && filteredMembers.every((m) => selectedMemberIds.includes(m.id))
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          </div>
        </div>

        <div className="data-table overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                <th className="px-3 py-2 text-left font-semibold">Nom</th>
                <th className="px-3 py-2 text-left font-semibold">Téléphone</th>
                <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Statut</th>
                <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className={`hover:bg-[var(--surface-soft)] transition-colors cursor-pointer ${selectedMemberIds.includes(member.id) ? "bg-[var(--surface-soft)]" : ""}`}
                  onClick={() => toggleMemberSelection(member.id)}
                >
                  <td className="px-3 py-2" data-label="Sélection">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="data-table-primary px-3 py-2 font-medium text-[var(--foreground)]" data-label="Nom">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-3 py-2" data-label="Téléphone">{member.phone}</td>
                  <td className="px-3 py-2 mobile-detail-cell text-[var(--muted-foreground)]" data-label="Email">{member.email ?? "-"}</td>
                  <td className="px-3 py-2" data-label="Statut">
                    <span className={`chip ${member.status === "ACTIVE" ? "chip-active" : "chip-muted"}`}>
                      {member.status === "ACTIVE" ? "ACTIF" : "RÉSILIÉ"}
                    </span>
                  </td>
                  <td className="px-3 py-2 mobile-detail-cell text-[var(--muted-foreground)]" data-label="Inscrit le">
                    {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-5 text-center text-[var(--muted-foreground)]">
                    Aucun membre trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Coché = membre affecté au groupe • Décoché = membre retiré
        </p>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
        <button type="button" onClick={() => router.push("/groups")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
      </div>

      <FeedbackMessage message={message} />
    </form>
  );
}
