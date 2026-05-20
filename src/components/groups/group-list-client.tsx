"use client";

import { useState } from "react";
import Link from "next/link";
import { GroupDto } from "@/types/group";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  MobileRowToggle,
  TableActionsCell,
  Td,
  Th,
} from "@/components/ui/responsive-table";

export function GroupListClient({ initialGroups }: { initialGroups: GroupDto[] }) {
  const [groups, setGroups] = useState<GroupDto[]>(initialGroups);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function toggleExpand(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

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
    const confirmed = window.confirm(
      "Confirmer la suppression de ce groupe ? Les seances planifiees seront egalement supprimees.",
    );
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
    const map: Record<string, string> = {
      MONDAY: "Lundi",
      TUESDAY: "Mardi",
      WEDNESDAY: "Mercredi",
      THURSDAY: "Jeudi",
      FRIDAY: "Vendredi",
      SATURDAY: "Samedi",
      SUNDAY: "Dimanche",
    };
    return map[value] ?? value;
  }

  function formatSchedules(schedules: GroupDto["schedules"]) {
    if (schedules.length === 0) return "—";
    return schedules.map((s) => `${dayLabel(s.dayOfWeek)} ${s.startTime} (${s.durationMinutes} min)`).join(", ");
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="sm:min-w-48 sm:flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Recherche</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom, sport, coach, salle..."
            className="field w-full text-xs"
          />
        </div>
        <div className="sm:ml-auto">
          <Link href="/groups/new" className="btn btn-primary btn-block-mobile inline-flex justify-center">
            + Créer un groupe
          </Link>
        </div>
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      <DataTable>
        <DataTableHead>
          <tr>
            <Th>Nom</Th>
            <Th>Sport</Th>
            <Th className="hidden sm:table-cell">Coach</Th>
            <Th className="hidden md:table-cell">Créneau</Th>
            <Th>Statut</Th>
            <Th className="hidden text-right sm:table-cell">Actions</Th>
            <Th className="px-2 text-center sm:hidden"> </Th>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroupIds.includes(group.id);
            return (
              <DataTableRow key={group.id} expanded={isExpanded}>
                <Td label="Nom" primary className="font-medium text-foreground">
                  {group.name}
                  <p className="text-xs text-muted-foreground">
                    Salle {group.room} • Cap. {group.capacity}
                  </p>
                </Td>
                <Td label="Sport" mobileDetail>
                  {group.sportName}
                </Td>
                <Td label="Coach" mobileDetail className="hidden sm:table-cell">
                  {group.coachName}
                </Td>
                <Td label="Créneau" mobileDetail className="hidden text-muted-foreground md:table-cell">
                  {formatSchedules(group.schedules)}
                </Td>
                <Td label="Statut" mobileDetail>
                  <StatusBadge variant={group.isActive ? "success" : "muted"}>
                    {group.isActive ? "Actif" : "Inactif"}
                  </StatusBadge>
                </Td>
                <TableActionsCell className="mobile-detail-cell">
                  <Link href={`/groups/${group.id}/schedules`} className="btn btn-ghost btn-sm">
                    Planifier
                  </Link>
                  <Link href={`/groups/${group.id}/edit`} className="btn btn-ghost btn-sm">
                    Modifier
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteGroup(group.id)}
                    disabled={actionLoadingId === group.id}
                    className="btn btn-danger btn-sm"
                  >
                    {actionLoadingId === group.id ? "..." : "Supprimer"}
                  </button>
                </TableActionsCell>
                <MobileRowToggle expanded={isExpanded} onToggle={() => toggleExpand(group.id)} />
              </DataTableRow>
            );
          })}
          {filteredGroups.length === 0 ? <DataTableEmpty colSpan={7} message="Aucun groupe trouvé." /> : null}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
