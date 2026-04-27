"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { CoachDto } from "@/types/coach";
import { GroupDto, DayOfWeekDto } from "@/types/group";
import { MemberDto } from "@/types/member";
import { SportDto } from "@/types/sport";
import { GroupMembersManager } from "@/components/groups/group-members-manager";

type GroupManagerProps = {
  initialGroups: GroupDto[];
  sportsOptions: SportDto[];
  coachesOptions: CoachDto[];
  membersOptions: MemberDto[];
};

const days: Array<{ value: DayOfWeekDto; label: string }> = [
  { value: "MONDAY", label: "Lundi" },
  { value: "TUESDAY", label: "Mardi" },
  { value: "WEDNESDAY", label: "Mercredi" },
  { value: "THURSDAY", label: "Jeudi" },
  { value: "FRIDAY", label: "Vendredi" },
  { value: "SATURDAY", label: "Samedi" },
  { value: "SUNDAY", label: "Dimanche" },
];

export function GroupManager({ initialGroups, sportsOptions, coachesOptions, membersOptions }: GroupManagerProps) {
  const [name, setName] = useState("");
  const [sportId, setSportId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [room, setRoom] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekDto>("MONDAY");
  const [startTime, setStartTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [createMembersSearch, setCreateMembersSearch] = useState("");
  const [createSelectedMemberIds, setCreateSelectedMemberIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>(initialGroups);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSportId, setEditSportId] = useState("");
  const [editCoachId, setEditCoachId] = useState("");
  const [editCapacity, setEditCapacity] = useState(20);
  const [editRoom, setEditRoom] = useState("");
  const [editDayOfWeek, setEditDayOfWeek] = useState<DayOfWeekDto>("MONDAY");
  const [editStartTime, setEditStartTime] = useState("18:00");
  const [editDurationMinutes, setEditDurationMinutes] = useState(60);
  const [editIsActive, setEditIsActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  const filteredMembersForCreate = membersOptions.filter((member) => {
    const query = createMembersSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || member.phone.toLowerCase().includes(query);
  });

  function toggleCreateMemberSelection(memberId: string) {
    setCreateSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((item) => item !== memberId) : [...current, memberId],
    );
  }

  function toggleSelectAllCreateMembers() {
    const visibleIds = filteredMembersForCreate.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => createSelectedMemberIds.includes(id));

    if (allVisibleSelected) {
      setCreateSelectedMemberIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setCreateSelectedMemberIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  async function generateSessions() {
    setGenerationLoading(true);
    setGenerationMessage(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horizonDays: 56 }),
    });

    const result = await response.json();

    if (!response.ok) {
      setGenerationMessage(result.error ?? "Erreur lors de la génération des séances");
      setGenerationLoading(false);
      return;
    }

    const data = result.data ?? {};
    setGenerationMessage(
      `Génération terminée: ${data.createdCount ?? 0} créées, ${data.skippedCount ?? 0} ignorées (sur ${data.candidatesCount ?? 0}).`,
    );
    setGenerationLoading(false);
  }

  async function reloadGroups(query?: string) {
    const params = new URLSearchParams();
    if (query && query.trim().length > 0) {
      params.set("q", query.trim());
    }

    const endpoint = params.toString() ? `/api/groups?${params.toString()}` : "/api/groups";
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    setGroups(result.data ?? []);
  }

  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reloadGroups(searchTerm);
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
        sportId,
        coachId,
        capacity,
        room,
        schedule: {
          dayOfWeek,
          startTime,
          durationMinutes,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du groupe");
      setLoading(false);
      return;
    }

    if (createSelectedMemberIds.length > 0 && result.data?.id) {
      const bulkResponse = await fetch("/api/group-members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: result.data.id,
          memberIds: createSelectedMemberIds,
          startDate: new Date().toISOString(),
          endDate: null,
        }),
      });

      const bulkResult = await bulkResponse.json();
      if (!bulkResponse.ok) {
        setMessage(`Groupe créé, mais échec affectation membres: ${bulkResult.error ?? "Erreur inconnue"}`);
        await reloadGroups();
        setLoading(false);
        return;
      }
    }

    setMessage("Groupe créé avec succès");
    setName("");
    setSportId("");
    setCoachId("");
    setCapacity(20);
    setRoom("");
    setDayOfWeek("MONDAY");
    setStartTime("18:00");
    setDurationMinutes(60);
    setCreateMembersSearch("");
    setCreateSelectedMemberIds([]);
    await reloadGroups();
    setLoading(false);
  }

  function startEdit(group: GroupDto) {
    setEditingId(group.id);
    setEditName(group.name);
    setEditSportId(group.sportId);
    setEditCoachId(group.coachId);
    setEditCapacity(group.capacity);
    setEditRoom(group.room);
    setEditDayOfWeek(group.schedule?.dayOfWeek ?? "MONDAY");
    setEditStartTime(group.schedule?.startTime ?? "18:00");
    setEditDurationMinutes(group.schedule?.durationMinutes ?? 60);
    setEditIsActive(group.isActive);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSportId("");
    setEditCoachId("");
    setEditCapacity(20);
    setEditRoom("");
    setEditDayOfWeek("MONDAY");
    setEditStartTime("18:00");
    setEditDurationMinutes(60);
    setEditIsActive(true);
  }

  async function saveEdit(groupId: string) {
    setActionLoadingId(groupId);
    setMessage(null);

    const response = await fetch("/api/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        payload: {
          name: editName,
          sportId: editSportId,
          coachId: editCoachId,
          capacity: editCapacity,
          room: editRoom,
          isActive: editIsActive,
          schedule: {
            dayOfWeek: editDayOfWeek,
            startTime: editStartTime,
            durationMinutes: editDurationMinutes,
          },
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification du groupe");
      setActionLoadingId(null);
      return;
    }

    setMessage("Groupe modifié avec succès");
    cancelEdit();
    await reloadGroups();
    setActionLoadingId(null);
  }

  async function deleteGroup(groupId: string) {
    const confirmed = window.confirm("Confirmer la suppression de ce groupe ?");
    if (!confirmed) {
      return;
    }

    setActionLoadingId(groupId);
    setMessage(null);

    const response = await fetch("/api/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression du groupe");
      setActionLoadingId(null);
      return;
    }

    setMessage("Groupe supprimé avec succès");
    if (editingId === groupId) {
      cancelEdit();
    }
    await reloadGroups();
    setActionLoadingId(null);
  }

  function dayLabel(value: DayOfWeekDto) {
    return days.find((day) => day.value === value)?.label ?? value;
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Gestion des groupes</h1>
      </div>

      <div className="grid w-full gap-6 md:grid-cols-2">
        <section className="panel panel-soft p-6">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">US-05 - Groupes d&apos;entraînement</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Création des groupes avec planning hebdomadaire récurrent (jour, heure, durée, salle).
          </p>
          <p className="mt-3 text-sm">
            <Link href="/coaches" className="font-medium text-[var(--primary)] underline">
              Gérer les coachs (US-04)
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe" className="field" required />
            <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field" required>
              <option value="">Choisir un sport</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="field" required>
              <option value="">Choisir un coach</option>
              {coachesOptions.map((coach) => (
                <option key={coach.id} value={coach.id}>{coach.firstName} {coach.lastName}</option>
              ))}
            </select>
            <input type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} placeholder="Capacité" className="field" required />
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Salle" className="field" required />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeekDto)} className="field" required>
                {days.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field" required />
              <input type="number" min={30} max={240} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="field" required />
            </div>

            <div className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--foreground)]">Membres à ajouter au groupe (optionnel)</p>
                <button type="button" className="btn btn-ghost text-xs" onClick={toggleSelectAllCreateMembers}>
                  {filteredMembersForCreate.length > 0 &&
                  filteredMembersForCreate.every((member) => createSelectedMemberIds.includes(member.id))
                    ? "Tout désélectionner"
                    : "Tout sélectionner"}
                </button>
              </div>
              <input
                value={createMembersSearch}
                onChange={(e) => setCreateMembersSearch(e.target.value)}
                placeholder="Rechercher membre"
                className="field mt-2 text-xs"
              />
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                {filteredMembersForCreate.map((member) => (
                  <li key={member.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={createSelectedMemberIds.includes(member.id)}
                      onChange={() => toggleCreateMemberSelection(member.id)}
                    />
                    <span className="font-medium text-[var(--foreground)]">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className="text-[var(--muted)]">• {member.phone}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Sélection actuelle: {createSelectedMemberIds.length} membre(s).</p>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm">
              {loading ? "Enregistrement..." : "Créer groupe"}
            </button>
          </form>

          {message ? <p className="mt-4 text-sm text-[var(--foreground)]">{message}</p> : null}
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Groupes enregistrés</h2>
            <form onSubmit={onSearchSubmit} className="flex w-full gap-2 sm:w-auto">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher nom/salle" className="field text-xs sm:w-56" />
              <button type="submit" className="btn btn-ghost whitespace-nowrap">Rechercher</button>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {groups.map((group) => (
              <li key={group.id} className="rounded-xl border border-[var(--border)] p-3">
                {editingId === group.id ? (
                  <div className="space-y-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="field text-xs" placeholder="Nom du groupe" />
                    <select value={editSportId} onChange={(e) => setEditSportId(e.target.value)} className="field text-xs">
                      <option value="">Choisir un sport</option>
                      {sportsOptions.map((sport) => (
                        <option key={sport.id} value={sport.id}>{sport.name}</option>
                      ))}
                    </select>
                    <select value={editCoachId} onChange={(e) => setEditCoachId(e.target.value)} className="field text-xs">
                      <option value="">Choisir un coach</option>
                      {coachesOptions.map((coach) => (
                        <option key={coach.id} value={coach.id}>{coach.firstName} {coach.lastName}</option>
                      ))}
                    </select>
                    <input type="number" min={1} max={200} value={editCapacity} onChange={(e) => setEditCapacity(Number(e.target.value))} className="field text-xs" />
                    <input value={editRoom} onChange={(e) => setEditRoom(e.target.value)} className="field text-xs" placeholder="Salle" />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select value={editDayOfWeek} onChange={(e) => setEditDayOfWeek(e.target.value as DayOfWeekDto)} className="field text-xs">
                        {days.map((day) => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>
                      <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="field text-xs" />
                      <input type="number" min={30} max={240} step={5} value={editDurationMinutes} onChange={(e) => setEditDurationMinutes(Number(e.target.value))} className="field text-xs" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                      Groupe actif
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveEdit(group.id)} disabled={actionLoadingId === group.id} className="btn btn-primary">Enregistrer</button>
                      <button type="button" onClick={cancelEdit} disabled={actionLoadingId === group.id} className="btn btn-ghost">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{group.name}</p>
                        <p className="text-xs text-[var(--muted)]">Sport: {group.sportName}</p>
                        <p className="text-xs text-[var(--muted)]">Coach: {group.coachName}</p>
                        <p className="text-xs text-[var(--muted)]">Salle: {group.room} • Capacité: {group.capacity}</p>
                        <p className="text-xs text-[var(--muted)]">
                          Créneau: {group.schedule ? `${dayLabel(group.schedule.dayOfWeek)} ${group.schedule.startTime} (${group.schedule.durationMinutes} min)` : "-"}
                        </p>
                      </div>
                      <span className={`chip ${group.isActive ? "chip-active" : "chip-muted"}`}>{group.isActive ? "ACTIF" : "INACTIF"}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => startEdit(group)} disabled={actionLoadingId === group.id} className="btn btn-ghost">Modifier</button>
                      <button type="button" onClick={() => deleteGroup(group.id)} disabled={actionLoadingId === group.id} className="btn btn-danger">Supprimer</button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {groups.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">Aucun groupe enregistré pour le moment.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="mt-6">
        <section className="panel p-6">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">US-07 - Génération des séances futures</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Génère les séances de J à J+56 depuis les groupes actifs et leurs créneaux, sans doublons.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                void generateSessions();
              }}
              disabled={generationLoading}
              className="btn btn-primary"
            >
              {generationLoading ? "Génération..." : "Générer séances J+56"}
            </button>
            {generationMessage ? <p className="text-sm text-[var(--foreground)]">{generationMessage}</p> : null}
          </div>
        </section>

        <GroupMembersManager groups={groups} members={membersOptions} />
      </div>
    </main>
  );
}
