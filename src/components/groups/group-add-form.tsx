"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { CoachDto } from "@/types/coach";
import { MemberDto } from "@/types/member";
import { SportDto } from "@/types/sport";

export function GroupAddForm({
  sportsOptions,
  coachesOptions,
  membersOptions,
}: {
  sportsOptions: SportDto[];
  coachesOptions: CoachDto[];
  membersOptions: MemberDto[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sports, setSports] = useState<SportDto[]>(sportsOptions);
  const [groupType, setGroupType] = useState<"KIDS" | "ADULTS">("ADULTS");
  const [sportId, setSportId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [room, setRoom] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reloadSports() {
    const response = await fetch("/api/sports?active=true", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) {
      setSports(result.data ?? []);
    }
  }

  function isMemberAllowed(memberType: MemberDto["memberType"]) {
    if (groupType === "KIDS") {
      return memberType === "KID" || memberType === "NOT_SPECIFIED";
    }
    return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
  }

  const filteredMembers = membersOptions.filter((member) => {
    const query = membersSearch.trim().toLowerCase();
    if (!query) return true;
    const matchesQuery = `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
    return matchesQuery;
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

    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        groupType,
        sportId,
        coachId,
        capacity,
        room,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du groupe");
      setLoading(false);
      return;
    }

    if (selectedMemberIds.length > 0 && result.data?.id) {
      const bulkResponse = await fetch("/api/group-members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: result.data.id,
          memberIds: selectedMemberIds,
          startDate: new Date().toISOString(),
          endDate: null,
        }),
      });
      const bulkResult = await bulkResponse.json();
      if (!bulkResponse.ok) {
        setMessage(`Groupe créé, mais échec affectation: ${bulkResult.error ?? "Erreur"}`);
        setLoading(false);
        return;
      }
    }

    setMessage("Groupe créé avec succès");
    setLoading(false);
    setTimeout(() => {
      router.push("/groups");
    }, 800);
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
            <select
              value={sportId}
              onFocus={() => void reloadSports()}
              onClick={() => void reloadSports()}
              onChange={(e) => setSportId(e.target.value)}
              className="field text-sm"
              required
            >
              <option value="">Choisir</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
            {sports.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--danger)]">
                Aucune discipline active trouvée. Créez ou activez une discipline.
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Type de groupe</label>
            <select
              value={groupType}
              onChange={(e) => {
                setGroupType(e.target.value as "KIDS" | "ADULTS");
                setSelectedMemberIds([]);
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
                <option key={coach.id} value={coach.id}>{coach.firstName} {coach.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Salle</label>
            <input value={room} onChange={(e) => setRoom(e.target.value)} className="field text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Capacité</label>
            <input type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="field text-sm" required />
          </div>
        </div>
      </div>

      {/* Member table matching /members style */}
      <div className="rounded-xl border border-[var(--border)] p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Membres à ajouter ({selectedMemberIds.length})
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
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">Sélection: {selectedMemberIds.length} membre(s)</p>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Créer groupe"}
        </button>
        <button type="button" onClick={() => router.push("/groups")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
      </div>

      <FeedbackMessage message={message} />
    </form>
  );
}
