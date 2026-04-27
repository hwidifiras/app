"use client";

import { useState } from "react";
import Link from "next/link";
import { GroupDto } from "@/types/group";

export function GroupListClient({ initialGroups }: { initialGroups: GroupDto[] }) {
  const [groups, setGroups] = useState<GroupDto[]>(initialGroups);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredGroups = groups.filter((group) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      group.name.toLowerCase().includes(query) ||
      group.sportName.toLowerCase().includes(query) ||
      group.coachName.toLowerCase().includes(query) ||
      group.room.toLowerCase().includes(query)
    );
  });

  async function deleteGroup(groupId: string) {
    const confirmed = window.confirm("Confirmer la suppression de ce groupe ?");
    if (!confirmed) return;

    setActionLoadingId(groupId);
    setMessage(null);

    const response = await fetch("/api/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression");
      setActionLoadingId(null);
      return;
    }

    setGroups((current) => current.filter((g) => g.id !== groupId));
    setMessage("Groupe supprimé avec succès");
    setActionLoadingId(null);
  }

  function dayLabel(value: string) {
    const labels: Record<string, string> = {
      MONDAY: "Lundi",
      TUESDAY: "Mardi",
      WEDNESDAY: "Mercredi",
      THURSDAY: "Jeudi",
      FRIDAY: "Vendredi",
      SATURDAY: "Samedi",
      SUNDAY: "Dimanche",
    };
    return labels[value] ?? value;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">Recherche</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom, sport, coach, salle..."
            className="field text-xs"
          />
        </div>
        <div className="ml-auto">
          <Link href="/groups/new" className="btn btn-primary inline-flex">
            + Créer un groupe
          </Link>
        </div>
      </div>

      {message ? (
        <p className={`mb-3 text-sm ${message.includes("succès") ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nom</th>
              <th className="px-4 py-3 text-left font-semibold">Sport</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Coach</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Créneau</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredGroups.map((group) => (
              <tr key={group.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                  {group.name}
                  <p className="text-xs text-[var(--muted)]">Salle {group.room} • Cap. {group.capacity}</p>
                </td>
                <td className="px-4 py-3">{group.sportName}</td>
                <td className="px-4 py-3 hidden sm:table-cell">{group.coachName}</td>
                <td className="px-4 py-3 hidden md:table-cell text-[var(--muted)]">
                  {group.schedule
                    ? `${dayLabel(group.schedule.dayOfWeek)} ${group.schedule.startTime} (${group.schedule.durationMinutes} min)`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <span className={`chip ${group.isActive ? "chip-active" : "chip-muted"}`}>
                    {group.isActive ? "ACTIF" : "INACTIF"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/groups/${group.id}/edit`}
                      className="btn btn-ghost text-xs px-2 py-1 min-h-0"
                    >
                      Modifier
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      disabled={actionLoadingId === group.id}
                      className="btn btn-danger text-xs px-2 py-1 min-h-0"
                    >
                      {actionLoadingId === group.id ? "..." : "Supprimer"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                  Aucun groupe trouvé.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
