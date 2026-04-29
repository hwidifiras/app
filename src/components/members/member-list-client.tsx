"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
type GroupOption = {
  id: string;
  name: string;
};

type MemberWithGroups = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: "ACTIVE" | "ARCHIVED";
  joinedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  groupIds: string[];
};

type MemberListClientProps = {
  initialMembers: MemberWithGroups[];
  groupsOptions: GroupOption[];
};

export function MemberListClient({ initialMembers, groupsOptions }: MemberListClientProps) {
  const [members, setMembers] = useState<MemberWithGroups[]>(initialMembers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      !searchTerm.trim() ||
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      member.phone.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      (member.email?.toLowerCase() ?? "").includes(searchTerm.trim().toLowerCase());

    const matchesStatus = statusFilter === "ALL" || member.status === statusFilter;
    const matchesGroup = groupFilter === "ALL" || member.groupIds.includes(groupFilter);

    return matchesSearch && matchesStatus && matchesGroup;
  });

  const reloadMembers = useCallback(async () => {
    const response = await fetch("/api/members", { cache: "no-store" });
    const result = await response.json();
    setMembers(result.data ?? []);
  }, []);

  async function archiveMember(memberId: string) {
    const confirmed = window.confirm("Confirmer l'archivage de ce membre ?");
    if (!confirmed) return;

    setActionLoadingId(memberId);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'archivage");
      setActionLoadingId(null);
      return;
    }

    setMessage("Membre archivé avec succès");
    await reloadMembers();
    setActionLoadingId(null);
  }

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="sm:flex-1 sm:min-w-[12rem]">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Recherche</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom, téléphone, email..."
            className="field text-xs w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="field text-xs w-full sm:w-auto sm:min-w-[8rem]"
          >
            <option value="ALL">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="ARCHIVED">Archivés</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Groupe</label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="field text-xs w-full sm:w-auto sm:min-w-[10rem]"
          >
            <option value="ALL">Tous les groupes</option>
            {groupsOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:ml-auto">
          <Link href="/members/new" className="btn btn-primary inline-flex w-full justify-center sm:w-auto">
            + Ajouter un membre
          </Link>
        </div>
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nom</th>
              <th className="px-4 py-3 text-left font-semibold">Téléphone</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Email</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Groupes</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Inscrit le</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                  {member.firstName} {member.lastName}
                </td>
                <td className="px-4 py-3">{member.phone}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-[var(--muted-foreground)]">
                  {member.email ?? "-"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {member.groupIds.length === 0 ? (
                    <span className="text-xs text-[var(--muted-foreground)]">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {member.groupIds.map((gid) => {
                        const gName = groupsOptions.find((g) => g.id === gid)?.name ?? gid.slice(0, 6);
                        return (
                          <span key={gid} className="chip chip-muted text-[10px] px-1.5 py-0.5">
                            {gName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                    {member.status === "ACTIVE" ? "Actif" : "Archivé"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-[var(--muted-foreground)]">
                  {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/members/${member.id}`}
                      className="btn btn-ghost text-xs px-2 py-1 min-h-0"
                    >
                      Détails
                    </Link>
                    <button
                      type="button"
                      onClick={() => archiveMember(member.id)}
                      disabled={actionLoadingId === member.id || member.status === "ARCHIVED"}
                      className="btn btn-danger text-xs px-2 py-1 min-h-0"
                    >
                      {actionLoadingId === member.id ? "..." : "Archiver"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  Aucun membre trouvé.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
