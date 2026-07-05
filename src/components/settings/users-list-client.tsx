"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail, Pencil, RotateCcw } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-layout";
import { ListSearch } from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { deriveUserRoleIntent, describeUserRights, userRoleIntentLabel } from "@/lib/user-role-intent";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
  permissions: { key: string }[];
};

export function UsersListClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "RECEPTION" | "COACH">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return users.filter((user) => {
      const permissionKeys = user.permissions.map((permission) => permission.key);
      const roleIntent = deriveUserRoleIntent(user.role, permissionKeys);
      const rightsLabel = describeUserRights(user.role, permissionKeys);
      const matchesSearch =
        !query ||
        user.name.toLocaleLowerCase("fr").includes(query) ||
        user.email.toLocaleLowerCase("fr").includes(query) ||
        userRoleIntentLabel(roleIntent).toLocaleLowerCase("fr").includes(query) ||
        rightsLabel.toLocaleLowerCase("fr").includes(query);
      const matchesRole = roleFilter === "ALL" || roleIntent === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? user.isActive : !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const activeFilterCount = [roleFilter !== "ALL", statusFilter !== "ALL"].filter(Boolean).length;
  const pagination = usePagination(filteredUsers, 12, `${searchTerm}|${roleFilter}|${statusFilter}`);

  function resetFilters() {
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  }

  function resetAll() {
    setSearchTerm("");
    resetFilters();
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditActive(user.isActive);
    setMessage(null);
  }

  async function saveEdit(user: UserRow) {
    if (user.isActive && !editActive && !window.confirm(`Désactiver le compte ${user.name} ?`)) {
      return;
    }

    const userId = user.id;
    setLoadingId(userId);
    setMessage(null);

    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, email: editEmail, isActive: editActive }),
    });
    const json = await res.json();
    setLoadingId(null);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur");
      return;
    }

    setEditingId(null);
    setMessage("Utilisateur mis à jour");
    router.refresh();
  }

  async function sendReset(userId: string) {
    setLoadingId(userId);
    setMessage(null);

    const res = await fetch(`/api/users/${userId}/send-reset`, { method: "POST" });
    const json = await res.json();
    setLoadingId(null);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur");
      return;
    }

    setMessage(
      json.data?.emailConfigured
        ? "Lien de réinitialisation envoyé par email"
        : "Le lien n'a pas pu être envoyé. Vérifiez la configuration des emails ou contactez l'administrateur.",
    );
  }

  if (users.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">Aucun utilisateur.</p>;
  }

  return (
    <div className="space-y-3">
      <FeedbackMessage
        message={message}
        variant={message?.includes("envoyé") || message?.includes("mis à jour") ? "success" : undefined}
      />

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] md:items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
            <ListSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Nom, email, rôle ou droit..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Profil</label>
            <select
              className="field text-xs"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
            >
              <option value="ALL">Tous</option>
              <option value="ADMIN">Admin</option>
              <option value="RECEPTION">Réception</option>
              <option value="COACH">Coach</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut</label>
            <select
              className="field text-xs"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="ALL">Tous</option>
              <option value="ACTIVE">Actifs</option>
              <option value="INACTIVE">Désactivés</option>
            </select>
          </div>
          {activeFilterCount > 0 || searchTerm ? (
            <button type="button" className="btn btn-ghost px-3" onClick={resetAll} title="Réinitialiser">
              <RotateCcw className="size-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {filteredUsers.length} compte{filteredUsers.length > 1 ? "s" : ""} affiché{filteredUsers.length > 1 ? "s" : ""}
        </p>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-5 text-center text-sm text-[var(--muted-foreground)]">
          Aucun compte ne correspond aux filtres.
          <div className="mt-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetAll}>
              Réinitialiser
            </button>
          </div>
        </div>
      ) : null}

      {pagination.pageItems.map((u) => {
        const isEditing = editingId === u.id;
        const isSelf = u.id === currentUserId;
        const permKeys = u.permissions.map((p) => p.key);
        const roleIntent = deriveUserRoleIntent(u.role, permKeys);
        const rightsLabel = describeUserRights(u.role, permKeys);

        return (
          <article key={u.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
            {isEditing ? (
              <div className="space-y-3">
                <FormField label="Nom">
                  <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </FormField>
                <FormField label="Email">
                  <input
                    className="field"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    disabled={isSelf}
                  />
                  Compte actif
                  {isSelf ? <span className="text-xs text-[var(--muted-foreground)]">(vous)</span> : null}
                </label>
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Désactiver coupe l&apos;accès au prochain chargement, sans supprimer les actions déjà tracées.
                </p>
                {u.isActive && !editActive && !isSelf ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>
                      Ce compte ne pourra plus ouvrir l&apos;application. Ses anciennes actions restent visibles dans le
                      journal.
                    </p>
                  </div>
                ) : null}
                <div className="list-card-actions mt-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-block-mobile"
                    disabled={loadingId === u.id}
                    onClick={() => saveEdit(u)}
                  >
                    {loadingId === u.id ? "..." : "Enregistrer"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{u.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge variant={u.role === "ADMIN" ? "info" : "muted"}>
                      {userRoleIntentLabel(roleIntent)}
                    </StatusBadge>
                    <StatusBadge variant={u.isActive ? "success" : "warning"}>
                      {u.isActive ? "Actif" : "Désactivé"}
                    </StatusBadge>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{rightsLabel}</p>
                <div className="list-card-actions mt-3">
                  <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => startEdit(u)}>
                    <Pencil className="size-3.5" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block-mobile"
                    disabled={loadingId === u.id || !u.isActive}
                    onClick={() => sendReset(u.id)}
                  >
                    <Mail className="size-3.5" />
                    {loadingId === u.id ? "Envoi..." : "Lien mot de passe"}
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}
      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalItems={users.length}
        pageSize={12}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}
