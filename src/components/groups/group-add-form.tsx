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
  const [coachSportOverrideReason, setCoachSportOverrideReason] = useState("");
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
  const selectedCoach = coachesOptions.find((coach) => coach.id === coachId);
  const needsCoachSportOverride = !coachIsQualifiedForSport(selectedCoach, sportId);

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
        coachSportOverrideReason: needsCoachSportOverride ? coachSportOverrideReason : "",
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
            <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
              La salle peut aussi être modifiée sur chaque séance.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Capacité</label>
            <input type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="field text-sm" required />
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
        title="Membres à ajouter"
        description="La sélection est facultative. Vous pourrez aussi affecter des membres plus tard."
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
          {loading ? "Enregistrement…" : "Créer le groupe"}
        </button>
      </FormActions>
    </form>
  );
}
