"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { FULL_STAFF_PERMISSIONS, PERMISSION_LABELS, parsePermissions } from "@/lib/permission-definitions";
import { Pagination, usePagination } from "@/components/ui/pagination";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
  permissions: { key: string }[];
};

function roleIntentLabel(user: UserRow) {
  if (user.role === "ADMIN") return "Admin";
  const permissions = parsePermissions(user.permissions.map((permission) => permission.key));
  const hasReceptionWork =
    permissions.includes("members.manage") ||
    permissions.includes("enrollment.manage") ||
    permissions.includes("payments.manage");

  return hasReceptionWork ? "Réception" : "Coach";
}

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
  const pagination = usePagination(users, 12);

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditActive(user.isActive);
    setMessage(null);
  }

  async function saveEdit(userId: string) {
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

      {pagination.pageItems.map((u) => {
        const isEditing = editingId === u.id;
        const isSelf = u.id === currentUserId;
        const permKeys = u.permissions.map((p) => p.key);
        const roleIntent = roleIntentLabel(u);
        const rightsLabel =
          u.role === "ADMIN"
            ? "Tous les droits"
            : parsePermissions(permKeys).length === FULL_STAFF_PERMISSIONS.length
              ? "Accès complet staff"
              : parsePermissions(permKeys)
                  .map((key) => PERMISSION_LABELS[key])
                  .join(", ") || "Aucun droit";

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
                <div className="list-card-actions mt-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-block-mobile"
                    disabled={loadingId === u.id}
                    onClick={() => saveEdit(u.id)}
                  >
                    {loadingId === u.id ? "…" : "Enregistrer"}
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
                      {roleIntent}
                    </StatusBadge>
                    <StatusBadge variant={u.isActive ? "success" : "warning"}>
                      {u.isActive ? "Actif" : "Désactivé"}
                    </StatusBadge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">{rightsLabel}</p>
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
                    {loadingId === u.id ? "Envoi…" : "Envoyer un lien"}
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
